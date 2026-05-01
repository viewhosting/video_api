<?php

namespace Controllers;

use Exception;
use \DateTime;
use \DateTimeZone;

/**
 * Clase base para controladores.
 * Procesa rutas, maneja sesiones y ofrece utilidades generales y de logging.
 */
class Controller {

	/** @var array|null Datos del cliente autenticado */
	protected $cliente_actual;

	/** @var array|null Usuario autenticado */
	protected $usuario;

	/** @var string Acción actual a ejecutar */
	protected $_action;

	/** @var array Parámetros adicionales de la URL */
	protected $_params;

	/** @var \Doctrine\DBAL\Connection Conexión a la base de datos local */
	protected $base;
	
	/** @var \Doctrine\DBAL\Connection Conexión a la base de datos externa */
	protected $base_externa;

	/** @var string Identificador único de traza para rastrear flujos */
	protected string $trace_id;

	/**
	 * Constructor del controlador.
	 * Inicializa conexiones y procesa la acción solicitada.
	 *
	 * @param array $params Parámetros de ruta
	 */
	public function __construct($params = []) {
		$this->base = \App::getDB();
		
		if(\Services\Config::getInstance()->get('base_externa') == true){
			$this->base_externa = \App::getDBEXT();
		}

		$this->trace_id = $this->generarUUIDv4();

		// Analizar parámetros de ruta
		$this->_parseParams($params);

		// Ejecutar acción solicitada con manejo global de errores
		try {
			if (method_exists($this, $this->_action)) {
				$this->{$this->_action}();
			} else {
				throw new \Exception("La acción '{$this->_action}' no existe en el controlador " . get_called_class());
			}
		} catch (\Exception $e) {
			// Cualquier error (de código o de ruta) se manda a la pantalla profesional
			$this->guardarLog("Error capturado: " . $e->getMessage(), 'system_error');
			$this->_CargarError($e->getMessage());
		}
	}

	/**
	 * Determina la acción a ejecutar según el primer parámetro de ruta.
	 */
	protected function _parseParams($params) {
		$this->_action = "defaultAction";

		if (!empty($params[0])) {
			$action = strtolower($params[0]) . "Action";
			if (method_exists($this, $action)) {
				array_shift($params);
				$this->_action = $action;
			} else if (get_called_class() == "Controllers\DefaultController") {
				$this->_action = "notFoundAction";
			}
		}

		$this->_params = $params;
	}

	/**
	 * Valida el acceso del cliente basándose en el Header 'X-API-KEY'.
	 * Verifica que el cliente esté activo y tenga el permiso 'video_api'.
	 */
	/**
	 * Valida el acceso del cliente.
	 * Soporta dos métodos: Sesión activa (Navegador) o Header X-API-KEY (API Directa).
	 */
	protected function validarAcceso() {
		// 1. Intentar validar por SESIÓN (Uso del Editor/Navegador)
		if (session_status() === PHP_SESSION_NONE) {
			@session_start();
		}

		


		// print_r($_SESSION);
		// exit;


		if (isset($_SESSION['logueo']) && $_SESSION['logueo'] === true) {
			$this->cliente_actual = $_SESSION['usuario'];
			return true;
		}

		// 2. Intentar validar por HEADER (Uso directo de API)
		$token = $_SERVER['HTTP_X_API_KEY'] ?? null;
		
		if ($token) {
			$cliente = $this->base->fetchAssociative(
				"SELECT * FROM clientes WHERE Secreto = ? AND Activo = 1", 
				[$token]
			);

			if ($cliente) {
				// Validar permisos 'video_api' para el cliente de la API Key
				$permisos = @unserialize($cliente['Permisos']);
				if (is_array($permisos) && in_array('video_api', $permisos)) {
					$this->cliente_actual = $cliente;
					return true;
				}
				$this->_CargarError("El cliente no tiene permisos para usar esta API (video_api)");
			}
			
			$this->_CargarError("API Key inválida o cliente inactivo");
		}

		// 3. Si no hay ni sesión ni API Key, error
		$this->guardarLog("Acceso denegado: Sin sesión ni Token", 'auth_error');
		$this->_CargarError("Acceso denegado: Se requiere sesión activa o API Key (X-API-KEY) válida.");
	}

	/**
	 * ==========================================
	 * SISTEMA DE LOGGING GENÉRICO
	 * ==========================================
	 */

	/**
	 * Función genérica para guardar cualquier tipo de log.
	 */
	protected function guardarLog($contenido, $origen = 'sistema', $tabla = 'app_logs') {
		$mensaje = (is_array($contenido) || is_object($contenido)) 
				   ? json_encode($contenido, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) 
				   : $contenido;

		try {
			$this->base->insert($tabla, [
				'mensaje_raw' => $mensaje,
				'origen'      => $origen,
				'trace_id'    => $this->trace_id ?? null,
				'fecha'       => date('Y-m-d H:i:s'),
				'request_url' => $_SERVER['REQUEST_URI'] ?? null,
				'method'      => $_SERVER['REQUEST_METHOD'] ?? null,
				'ip'          => $_SERVER['REMOTE_ADDR'] ?? null
			]);
			return true;
		} catch (Exception $e) {
			error_log("Error crítico de log en {$tabla}: " . $e->getMessage());
			return false;
		}
	}

	/**
	 * Captura automáticamente la petición HTTP entrante actual.
	 */
	protected function logRequest($etiqueta = 'incoming_request') {
		return $this->guardarLog([
			'headers' => getallheaders(),
			'query'   => $_GET,
			'post'    => $_POST,
			'body'    => file_get_contents('php://input')
		], $etiqueta);
	}

	/**
	 * ==========================================
	 * PETICIONES HTTP (cURL)
	 * ==========================================
	 */

	/**
	 * Realiza una petición HTTP externa con log automático opcional.
	 */
	protected function _Peticion($url, $campos = [], $cabeza = [], $peticion = 'GET', $form = 'json', $sandbox = false, $log = true) {
		$peticion = strtoupper($peticion);
		$isPostLike = in_array($peticion, ['POST', 'PUT', 'PATCH', 'DELETE']);

		if ($isPostLike) {
			switch ($form) {
				case 'form':
					$campos_payload = http_build_query($campos);
					$cabeza[] = 'Content-Type: application/x-www-form-urlencoded';
					break;
				case 'json':
					$campos_payload = json_encode($campos);
					$cabeza[] = 'Content-Type: application/json';
					break;
				case 'multipart':
					$campos_payload = $campos;
					break;
				default:
					$campos_payload = $campos;
			}
		}

		if (empty($cabeza)) {
			$cabeza = ['Authorization: ' . \Services\Config::getInstance()->get('authorization_key')];
		}

		$curl = curl_init();
		curl_setopt_array($curl, [
			CURLOPT_URL => $url,
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_CUSTOMREQUEST => $peticion,
			CURLOPT_HTTPHEADER => $cabeza,
			CURLOPT_SSL_VERIFYPEER => false,
			CURLOPT_POSTFIELDS => $isPostLike ? ($campos_payload ?? null) : null,
			CURLOPT_TIMEOUT => 30
		]);

		$response = curl_exec($curl);
		$error = curl_error($curl);
		curl_close($curl);

		$decoded = json_decode($response, true);
		$isJson = (json_last_error() === JSON_ERROR_NONE);
		
		if ($sandbox) {
			echo "<pre>🔗 URL: $url\n🛠 Método: $peticion\n📤 Enviado (" . $form . "):\n";
			print_r($campos);
			echo "\n📩 Respuesta:\n";
			print_r($isJson ? $decoded : $response);
			if (!empty($error)) echo "\n❌ Error cURL:\n$error";
			echo "</pre>";
		}

		if ($log) {
			$this->guardarLog([
				'url'      => $url,
				'method'   => $peticion,
				'sent'     => $campos,
				'received' => $isJson ? $decoded : $response,
				'error'    => $error
			], 'outgoing_api_request');
		}

		return $isJson ? $decoded : $response;
	}

	/**
	 * ==========================================
	 * SESIONES Y SEGURIDAD
	 * ==========================================
	 */

	protected function verificarSession() {
		if (!$this->isAuthenticated()) {
			$this->handleUnauthenticatedAccess();
			return;
		}
		$_SESSION['LAST_ACTIVITY'] = time();
		$this->loadUserSessionData();
	}

	protected function isAuthenticated() {
		return isset($_SESSION['logueo']) && $_SESSION['logueo'] === true;
	}

	protected function handleUnauthenticatedAccess() {
		if ($this->isAjaxRequest()) {
			$this->sendJsonUnauthorizedResponse();
			return;
		}
		$this->redirectToLogin();
	}

	protected function sendJsonUnauthorizedResponse() {
		http_response_code(401);
		header('Content-Type: application/json');
		echo json_encode([
			'redirect' => '/login',
			'message' => 'Sesión no válida',
			'status' => 'unauthorized'
		]);
		exit;
	}

	protected function redirectToLogin() {
		header('Location: /login');
		exit;
	}

	protected function loadUserSessionData() {
		$this->usuario = $_SESSION['usuario'] ?? null;
	}

	protected function isAjaxRequest() {
		return isset($_SERVER['HTTP_X_REQUESTED_WITH']) && 
			strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
	}

	/**
	 * ==========================================
	 * CRIPTOGRAFÍA Y IDENTIFICACIÓN
	 * ==========================================
	 */

	protected function _encriptar(string $token): string {
		$method = \Services\Config::getInstance()->get('encrypt_method');
		$key = hash('sha256', \Services\Config::getInstance()->get('secret_key'), true);
		$iv = random_bytes(openssl_cipher_iv_length($method));
		
		$ciphertext = openssl_encrypt($token, $method, $key, OPENSSL_RAW_DATA, $iv);
		$hmac = hash_hmac('sha256', $iv . $ciphertext, $key, true);
		
		return base64_encode($iv . $hmac . $ciphertext);
	}
	
	protected function _desciptar(string $encrypted): string {
		$method = \Services\Config::getInstance()->get('encrypt_method');
		$key = hash('sha256', \Services\Config::getInstance()->get('secret_key'), true);
		
		// Corregimos posibles espacios por '+' si viene de un GET no saneado
		$data = base64_decode(str_replace(' ', '+', $encrypted));
		
		$ivLength = openssl_cipher_iv_length($method);
		$iv = substr($data, 0, $ivLength);
		$hmac = substr($data, $ivLength, 32);
		$ciphertext = substr($data, $ivLength + 32);
		
		if (!hash_equals(hash_hmac('sha256', $iv . $ciphertext, $key, true), $hmac)) {
			throw new Exception("Hash mismatch");
		}
		
		return openssl_decrypt($ciphertext, $method, $key, OPENSSL_RAW_DATA, $iv);
	}

	protected function getDeviceIdentifier() {
		$deviceString = ($_SERVER['HTTP_USER_AGENT'] ?? '') . ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '');
		return hash('sha256', $deviceString);
	}

	protected function generateDeviceUUID($userId, $deviceId) {
		$hash = hash('sha256', $userId . $deviceId . \Services\Config::getInstance()->get('secret_key'), true);
		$data = substr($hash, 0, 16);
		$data[6] = chr(ord($data[6]) & 0x0f | 0x40);
		$data[8] = chr(ord($data[8]) & 0x3f | 0x80);
		return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
	}

	/**
	 * ==========================================
	 * HELPERS
	 * ==========================================
	 */

	protected function GenerarHora($tipo = 'completa', $formato = null) {
		$zona = new DateTimeZone('America/Mexico_City');
		$ahora = new DateTime('now', $zona);
		if ($tipo === 'date') return $ahora;
		$formato = $formato ?: ($tipo === 'hora' ? 'H:i:s' : ($tipo === 'fecha' ? 'Y-m-d' : 'Y-m-d H:i:s'));
		return $ahora->format($formato);
	}

	protected function generarUUIDv4() {
		$data = random_bytes(16);
		$data[6] = chr(ord($data[6]) & 0x0f | 0x40);
		$data[8] = chr(ord($data[8]) & 0x3f | 0x80);
		return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
	}

	/**
	 * Carga la respuesta de error.
	 * Si es una petición AJAX responde JSON, de lo contrario carga la plantilla Twig.
	 */
	protected function _CargarError($error) {
		$status_code = http_response_code();
		if ($status_code < 400) $status_code = 403; // Asegurar que el status sea de error

		$vars = [
			'error' => $error,
			'status' => $status_code
		];

		if ($this->isAjaxRequest()) {
			header('Content-Type: application/json');
			$vars['trace_id'] = $this->trace_id ?? 'N/A';
			echo json_encode($vars);
			die();
		}

		// Usamos el nuevo método render para cargar la plantilla de error
		$this->render('view/error', $vars);
	}

	protected function getDominioOriginal() {
		return $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'];
	}

	/**
	 * Renderiza una plantilla Twig con variables globales.
	 */
	protected function render($view, $data = []) {
		$basePath = dirname(__DIR__, 2);
		$templateDir = str_replace('/', DIRECTORY_SEPARATOR, $basePath . '/templates');
		
		if (!is_dir($templateDir)) {
			die("Error: Directorio de plantillas no encontrado en " . $templateDir);
		}

		try {
			$loader = new \Twig\Loader\FilesystemLoader($templateDir);
			$twig = new \Twig\Environment($loader);
			
			// Inyectar variables globales del sistema
			$data['version'] = \Services\Config::getInstance()->get('version');
			$data['copyright'] = \Services\Config::getInstance()->get('copyright');
			$data['trace_id'] = $this->trace_id;
			$data['cliente'] = $this->cliente_actual ?? null;

			echo $twig->render($view . '.twig', $data);
		} catch (Exception $e) {
			$this->_CargarError("Error al renderizar la vista '{$view}': " . $e->getMessage());
		}
		exit;
	}
}