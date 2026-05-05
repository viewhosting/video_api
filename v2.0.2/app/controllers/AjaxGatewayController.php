<?php

namespace Controllers;

use Exception;
use ReflectionMethod;

class AjaxGatewayController extends Controller {

    public function defaultAction() {
        header('Content-Type: application/json');

        try {
            // Detectar si la petición es multipart (subida de archivo binario)
            $isMultipart = isset($_SERVER['CONTENT_TYPE']) && str_contains($_SERVER['CONTENT_TYPE'], 'multipart/form-data');

            // 1. Validar la llave de autorización
            // En multipart los headers siguen llegando como HTTP headers normales
            $headers = getallheaders();
            $authKeyHeader = $headers['X-Authorization-Key'] ?? ($headers['x-authorization-key'] ?? '');
            
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

            // 3. Obtener Acción a ejecutar
            $actionStr = $headers['X-Action'] ?? ($headers['x-action'] ?? '');
            if (!$actionStr || strpos($actionStr, '@') === false) {
                throw new Exception('SECURITY_VIOLATION: Invalid action format.');
            }

            list($controllerName, $methodName) = explode('@', $actionStr);

            // Validar que el controlador sea seguro de invocar
            $allowedControllers = ['TemplatesController', 'VideoController']; // Lista blanca de controladores permitidos por AJAX
            if (!in_array($controllerName, $allowedControllers)) {
                throw new Exception('SECURITY_VIOLATION: Unauthorized controller.');
            }

            $fullControllerClass = "\\Controllers\\" . $controllerName;
            if (!class_exists($fullControllerClass)) {
                throw new Exception('SECURITY_VIOLATION: Controller not found.');
            }

            // 4. Rotar el Nonce antes de ejecutar la acción
            // Generar nuevo nonce, guardarlo en sesión y encriptarlo
            $newNonce = bin2hex(random_bytes(16));
            $_SESSION['nonce_ajax'] = $newNonce;
            $newEncryptedNonce = $this->_encriptar($newNonce);

            // Capturar la salida original de la ejecución mediante output buffering
            // ya que los métodos originales usaban echo json_encode() y exit;
            // Para poder inyectar el nuevo nonce, vamos a interceptar su JSON.
            
            // Instanciar el controlador objetivo
            $controllerInstance = new $fullControllerClass();
            
            // Usar ReflectionMethod para acceder a métodos privados/protegidos
            if (!method_exists($controllerInstance, $methodName)) {
                throw new Exception('SECURITY_VIOLATION: Method not found.');
            }

            $reflectionMethod = new ReflectionMethod($controllerInstance, $methodName);
            $reflectionMethod->setAccessible(true); // Saltamos restricción private/protected
            
            // Iniciar buffer
            ob_start();
            
            try {
                // Ejecutamos (esto asume que el método lee php://input por sí solo)
                // y que al final hace un echo de JSON y *quizás* llama a exit.
                // Para prevenir que el exit nos mate el proceso y no podamos inyectar el nonce,
                // vamos a registrar una función de shutdown temporal, o cambiar la arquitectura
                // de los controladores para que hagan "return" del array en vez de "exit".
                // Como nos pidieron NO modificar las funciones originales y dejarlas tal cual, 
                // pero si hacen `exit` nos complicará. Revisaremos si podemos cambiar su exit a return.
                
                $result = $reflectionMethod->invoke($controllerInstance);
                
                // Si el método devuelve un array directamente
                if (is_array($result)) {
                    $result['__new_nonce'] = $newEncryptedNonce;
                    ob_end_clean();
                    echo json_encode($result);
                    exit;
                }
                
                $output = ob_get_clean();
                
                // Si hizo echo, intentamos parsearlo
                $json = json_decode($output, true);
                if ($json && is_array($json)) {
                    $json['__new_nonce'] = $newEncryptedNonce;
                    echo json_encode($json);
                    exit;
                }
                
                // Fallback
                echo json_encode(['success' => true, '__new_nonce' => $newEncryptedNonce]);
                exit;
                
            } catch (Exception $e) {
                ob_end_clean();
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
