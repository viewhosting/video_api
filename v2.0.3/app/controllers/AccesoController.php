<?php

namespace Controllers;

/**
 * AccesoController
 * Maneja el apretón de manos (handshake) seguro entre la plataforma externa y el editor.
 * Valida identidad, tiempo, origen y permisos antes de iniciar la sesión.
 */
class AccesoController extends Controller {

    public function __construct($params = []) {
        parent::__construct($params);
    }

    /**
     * Procesa el login vía token encriptado (SSO)
     * URL esperada: /acceso?t=LLAVEPUBLICA
     */
    public function defaultAction() {


    //    echo $this->_encriptar('9|'.time().'|esteesunsecretoparavideo|apis.clientesunikms.com');
    //     exit;
        // echo $this->_encriptar('esteesunsecretoparavideo');
        // exit;

        $token = $_GET['t'] ?? '';

        if (empty($token)) {
            $this->_CargarError("Llave de acceso no proporcionada.");
        }

        try {
            // 1. OBTENCIÓN DE TOKENS (Decodificados)
            $token_nonce = urldecode($_GET['t'] ?? '');
            $token_id    = urldecode($_GET['id'] ?? '');

            if (empty($token_nonce) || empty($token_id)) {
                throw new \Exception("Parámetros de acceso incompletos.");
            }
         


            // 2. DESENCRIPTACIÓN DE LA IDENTIDAD DEL CLIENTE (data_id)
            // Formato esperado en 'id': ID_CLIENTE | DOMINIO_PERMITIDO (y opcionalmente secreto)
            $decrypted_id = $this->_desciptar($token_id);
            $parts_id = explode('|', $decrypted_id);
            

            
            if (count($parts_id) < 2) {
                throw new \Exception("Estructura de llave de cliente inválida.");
            }


            $clientId      = $parts_id[0];
            // El dominio permitido asumo que es la segunda posición
            $allowedDomain = $parts_id[3];






            // Si hay un tercer parámetro para secreto
            $sessionSecret = $parts_id[2] ?? \Services\Config::getInstance()->get('secret_session');

            // 3. DESENCRIPTACIÓN DEL NONCE Y TIMESTAMP (Generado por llaveAction)
            // Formato esperado en 't': TIMESTAMP | NONCE
            $decrypted_nonce = $this->_desciptar($token_nonce);
            $parts_nonce = explode('|', $decrypted_nonce);
            if (count($parts_nonce) !== 2) {
                throw new \Exception("Estructura de llave de seguridad inválida.");
            }

            $timestamp = (int)$parts_nonce[0];
            $nonce     = $parts_nonce[1];

            // 4. VALIDACIÓN DE NONCE (Anti-Replay Attack)
            @session_start();
            if (!isset($_SESSION['video_nonce']) || $_SESSION['video_nonce'] !== $nonce) {
                throw new \Exception("El token de acceso es inválido o ya fue utilizado (Hash Único expirado).");
            }
            // Consumir el nonce actual
            unset($_SESSION['video_nonce']);

            // 5. VALIDACIÓN DE TIEMPO
            // Si el usuario ya estaba logueado en esta sesión, le damos 24 horas. Si es nueva petición, 60 segundos.
            $isLoggedIn = isset($_SESSION['logueo']) && $_SESSION['logueo'] === true;
            $maxTime = $isLoggedIn ? 86400 : 60; 
            
            if (abs(time() - $timestamp) > $maxTime) {
                throw new \Exception("La llave de acceso ha expirado por inactividad. Por favor, recarga la página para generar una nueva.");
            }

            // 6. VALIDACIÓN DE ORIGEN (Opcional)
            $referer = $_SERVER['HTTP_REFERER'] ?? '';
            if (!empty($referer) && !str_contains($referer, $allowedDomain)) {

                print_r([
                    'error' => 'Referer no coincide',
                    'referer' => $referer,
                    'allowed' => $allowedDomain
                ]);

                $this->guardarLog([
                    'error' => 'Referer no coincide',
                    'referer' => $referer,
                    'allowed' => $allowedDomain
                ], 'security_alert');
                throw new \Exception("Origen de petición no permitido para este cliente.");
            }

            // 4. VALIDACIÓN EN BASE DE DATOS
            $cliente = $this->base->fetchAssociative("
                SELECT c.*, d.dominio as dominio_config 
                FROM clientes c 
                INNER JOIN dominios__ d ON d.idClientes = c.idClientes 
                WHERE c.idClientes = ? 
                AND c.Activo = 1 
                AND d.dominio LIKE ?
            ", [$clientId, "%$allowedDomain%"]);

            if (!$cliente) {
                throw new \Exception("Cliente no autorizado o configuración de dominio no coincide.");
            }

            // Validar permiso específico para usar esta herramienta
            $permisos = @unserialize($cliente['Permisos']);
            if (!is_array($permisos) || !in_array('video_api', $permisos)) {
                throw new \Exception("El cliente no cuenta con el permiso requerido (video_api).");
            }

            // 5. ESTABLECIMIENTO DE SESIÓN PHP
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            
            $_SESSION['logueo'] = true;
            $_SESSION['usuario'] = [
                'idClientes' => $clientId,
                'dominio' => $allowedDomain
            ];

            $this->guardarLog("Handshake exitoso: Cliente #{$clientId} [{$cliente['Nombre']}] desde {$allowedDomain}", 'auth_success');

            // Redirigimos al editor directamente. CorrerController se encargará de mandar el nuevo token al padre.
            header('Location: ' . \Services\Config::getInstance()->get('domain') . '/correr');
            exit;

        } catch (\Exception $e) {
            $this->guardarLog("Fallo de Handshake: " . $e->getMessage(), 'auth_error');
            
            echo <<<HTML
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({function: "Error", mensaje: "{$e->getMessage()}"}, "*");
                        window.close();
                    } else {
                        document.write("Error: {$e->getMessage()}");
                    }
                </script>
            </body>
            </html>
            HTML;
            exit;
        }
    }

    public function llaveAction() {

        // echo $this->_encriptar('esteesunsecretoparavideo');
        // exit;

        @session_start();
        $nonce = bin2hex(random_bytes(16));
        $_SESSION['video_nonce'] = $nonce;

        // Armar el payload dinámico: TIME | NONCE
        $payload = time() . "|$nonce";
        $token_encriptado = $this->_encriptar($payload);

        // Calcular la URL base dinámicamente desde el config global
        $baseUrl = \Services\Config::getInstance()->get('domain');

        header('Content-Type: application/javascript');

        $jsPath = __DIR__ . '/../../private_assets/js/__auth_bridge_x92.js';
        
        if (file_exists($jsPath)) {
            $jsContent = file_get_contents($jsPath);
            // Inyectamos las variables dinámicas en el JS
            $jsContent = str_replace('{{LLAVE_ENCRIPTADA}}', $token_encriptado, $jsContent);
            $jsContent = str_replace('{{BASE_URL}}', $baseUrl, $jsContent);
            echo $jsContent;
        } else {
            echo "console.error('Video API Error: Archivo de puente de seguridad no encontrado.');";
        }
        exit;
    }
}
