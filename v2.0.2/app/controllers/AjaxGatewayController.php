<?php

namespace Controllers;

use Exception;
use ReflectionMethod;

/**
 * AjaxGatewayController
 * Punto de entrada único para peticiones AJAX ofuscadas.
 * Valida Authorization-Key, Nonce dinámico y Sesión.
 */
class AjaxGatewayController extends Controller {

    /**
     * Constructor: Refuerza la seguridad exigiendo sesión antes de procesar el Gateway.
     */
    public function __construct() {
        parent::__construct();
        $this->validarAcceso();
    }

    public function defaultAction() {
        header('Content-Type: application/json');

        try {
            // Detectar si la petición es multipart
            $isMultipart = isset($_SERVER['CONTENT_TYPE']) && str_contains($_SERVER['CONTENT_TYPE'], 'multipart/form-data');

            $headers = getallheaders();
            $authKeyHeader = $headers['X-Authorization-Key'] ?? ($headers['x-authorization-key'] ?? '');
            
            // 1. Validar la llave de autorización (Config)
            $configAuthKey = \Services\Config::getInstance()->get('authorization_key');
            if ($authKeyHeader !== $configAuthKey) {
                throw new Exception('SECURITY_VIOLATION: Invalid authorization key.');
            }

            // 2. Validar el Nonce Encriptado
            $encryptedNonce = $headers['X-Nonce'] ?? ($headers['x-nonce'] ?? '');
            if (!$encryptedNonce) {
                throw new Exception('SECURITY_VIOLATION: Missing nonce.');
            }

            $decryptedNonce = $this->_desciptar($encryptedNonce);
            $sessionNonce = $_SESSION['nonce_ajax'] ?? null;

            if (!$sessionNonce || $decryptedNonce !== $sessionNonce) {
                throw new Exception('SECURITY_VIOLATION: Invalid or expired nonce.');
            }

            // 3. Obtener Acción (Ofuscada: ej: Templates@save)
            $actionStr = $headers['X-Action'] ?? ($headers['x-action'] ?? '');
            if (!$actionStr || strpos($actionStr, '@') === false) {
                throw new Exception('SECURITY_VIOLATION: Invalid action format.');
            }

            list($ctrlShortName, $methodShortName) = explode('@', $actionStr);

            // 4. Inflar nombres y validar
            $controllerName = $ctrlShortName . "Controller";
            $methodName     = $methodShortName . "Action";

            $allowedControllers = ['Templates', 'Video']; 
            if (!in_array($ctrlShortName, $allowedControllers)) {
                throw new Exception('SECURITY_VIOLATION: Unauthorized controller.');
            }

            $fullControllerClass = "\\Controllers\\" . $controllerName;
            if (!class_exists($fullControllerClass)) {
                throw new Exception('SECURITY_VIOLATION: Controller not found.');
            }

            // 5. Rotar el Nonce
            $newNonce = bin2hex(random_bytes(16));
            $_SESSION['nonce_ajax'] = $newNonce;
            $newEncryptedNonce = $this->_encriptar($newNonce);

            // Instanciar el controlador objetivo
            $controllerInstance = new $fullControllerClass();
            
            if (!method_exists($controllerInstance, $methodName)) {
                throw new Exception('SECURITY_VIOLATION: Method not found.');
            }

            $reflectionMethod = new ReflectionMethod($controllerInstance, $methodName);
            $reflectionMethod->setAccessible(true);
            
            ob_start();
            
            try {
                $result = $reflectionMethod->invoke($controllerInstance);
                
                if (is_array($result)) {
                    $result['__new_nonce'] = $newEncryptedNonce;
                    ob_end_clean();
                    echo json_encode($result);
                    exit;
                }
                
                $output = ob_get_clean();
                $json = json_decode($output, true);
                if ($json && is_array($json)) {
                    $json['__new_nonce'] = $newEncryptedNonce;
                    echo json_encode($json);
                    exit;
                }
                
                echo json_encode(['success' => true, '__new_nonce' => $newEncryptedNonce]);
                exit;
                
            } catch (Exception $e) {
                if (ob_get_length()) ob_end_clean();
                echo json_encode(['success' => false, 'error' => $e->getMessage(), '__new_nonce' => $newEncryptedNonce]);
                exit;
            }

        } catch (Exception $e) {
            $msg = $e->getMessage();
            if (strpos($msg, 'SECURITY_VIOLATION') !== false) {
                http_response_code(403);
                echo json_encode(['error' => 'SECURITY_VIOLATION']);
            } else {
                echo json_encode(['success' => false, 'error' => $msg]);
            }
            exit;
        }
    }
}
