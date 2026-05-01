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
    //    exit;




        $token = $_GET['t'] ?? '';

        if (empty($token)) {
            $this->_CargarError("Llave de acceso no proporcionada.");
        }

        try {
            // 1. DESENCRIPTACIÓN
            // El token debe haber sido cifrado con la secret_key y secret_iv del config.php
            // Formato esperado: ID_CLIENTE | TIMESTAMP | SECRETO_SESION | DOMINIO_PERMITIDO
            $decrypted = $this->_desciptar($token);
            $parts = explode('|', $decrypted);
          //  print_r($parts);
            if (count($parts) !== 4) {
                throw new \Exception("Estructura de llave inválida.");
            }

            $clientId      = $parts[0];
            $timestamp     = (int)$parts[1];
            $sessionSecret = $parts[2];
            $allowedDomain = $parts[3];

            // 2. VALIDACIÓN DE TIEMPO (Handshake de máximo 60 segundos)
            // Evita ataques de repetición con URLs viejas
            if (abs(time() - $timestamp) > 60) {
              //  throw new \Exception("La llave de acceso ha expirado por seguridad. Intente nuevamente desde su panel.");
            }

            // 3. VALIDACIÓN DE ORIGEN (Referer)
            // Verificamos que la ventana que abrió esta venga del dominio permitido en el token
            $referer = $_SERVER['HTTP_REFERER'] ?? '';
            if (!empty($referer) && !str_contains($referer, $allowedDomain)) {
                $this->guardarLog([
                    'error' => 'Referer no coincide',
                    'referer' => $referer,
                    'allowed' => $allowedDomain
                ], 'security_alert');
                throw new \Exception("Origen de petición no permitido para este cliente.");
            }

            // 4. VALIDACIÓN EN BASE DE DATOS
            // Cruzamos con la tabla dominios__ para verificar que el dominio esté autorizado para ese cliente
            $cliente = $this->base->fetchAssociative("
                SELECT c.*, d.dominio as dominio_config 
                FROM clientes c 
                INNER JOIN dominios__ d ON d.idClientes = c.idClientes 
                WHERE c.idClientes = ? 
                AND c.Activo = 1 
                AND d.dominio LIKE ?
            ", [$clientId, "%$allowedDomain%"]);

            // print_r($clientId);
            // print_r('<br>');
            // print_r($allowedDomain);
            // exit;

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
            
            $_SESSION['logueo']     = true;
            $_SESSION['usuario']    = $cliente;
            $_SESSION['secreto']    = $sessionSecret; // Clave dinámica para el Proxy de JS
            $_SESSION['trace_auth'] = $this->trace_id;

            $this->guardarLog("Handshake exitoso: Cliente #{$clientId} [{$cliente['Nombre']}] desde {$allowedDomain}", 'auth_success');

            // 6. REDIRECCIÓN AL EDITOR (CorrerController)
            header("Location: /video_api/correr");
            exit;

        } catch (\Exception $e) {
            $this->guardarLog("Fallo de Handshake: " . $e->getMessage(), 'auth_error');
            $this->_CargarError($e->getMessage());
        }
    }
}
