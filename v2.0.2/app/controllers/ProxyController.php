<?php

namespace Controllers;

class ProxyController extends Controller {
    
    /**
     * Sobreescribimos el parseo de parámetros para que el primer segmento
     * sea siempre el TOKEN y no intente buscar una acción con ese nombre.
     */
    protected function _parseParams($params) {
        $this->_action = 'defaultAction'; // Forzamos la acción por defecto
        $this->_params = $params;         // Mantenemos todos los segmentos
    }

    /**
     * El Proxy valida el token de sesión y sirve el archivo
     */
    public function defaultAction() {
        $token    = $this->_params[0] ?? '';
        $category = $this->_params[1] ?? '';
        
        // Capturamos todos los segmentos restantes para formar la ruta completa del archivo
        $fileNameSegments = array_slice($this->_params, 2);
        $fileName = implode('/', $fileNameSegments);

        try {
            $this->validarTokenSesion($token);

            if (empty($category) || empty($fileName)) {
                throw new \Exception("Ruta de asset incompleta");
            }

            // Procesamiento especial para fuentes CSS
            if ($category === 'css' && strpos($fileName, 'fonts') !== false) {
                $this->serveProcessedFontsCss($token);
                exit;
            }

            $this->serveFile($category, $fileName);

        } catch (\Exception $e) {
            header('HTTP/1.1 403 Forbidden');
            echo "/* Proxy Security Error: " . $e->getMessage() . " */";
            exit;
        }
    }

    /**
     * Valida que el token de la URL coincida con el de la sesión activa
     */
    private function validarTokenSesion($token) {
        if (session_status() === PHP_SESSION_NONE) @session_start();

        $sessionToken = $_SESSION['proxy_token'] ?? '';
        $expire = $_SESSION['proxy_token_expire'] ?? 0;

        if (empty($sessionToken) || $token !== $sessionToken) {
            throw new \Exception("Acceso denegado: Token inválido");
        }

        if (time() > $expire) {
            throw new \Exception("Acceso denegado: Token expirado");
        }

        return true;
    }

    /**
     * Sirve archivos estáticos desde la carpeta privada
     */
    private function serveFile($category, $fileName) {
        $info = pathinfo($fileName);
        $ext = $info['extension'] ?? '';
        
        $mimes = [
            'js'    => 'application/javascript',
            'css'   => 'text/css',
            'wasm'  => 'application/wasm',
            'woff2' => 'font/woff2',
            'woff'  => 'font/woff',
            'ttf'   => 'font/ttf',
            'svg'   => 'image/svg+xml'
        ];

        $contentType = $mimes[$ext] ?? 'application/octet-stream';
        $filePath = dirname(__DIR__, 2) . "/private_assets/{$category}/{$fileName}";

        if (file_exists($filePath)) {
            header("Content-Type: {$contentType}");
            header('Cache-Control: public, max-age=3600');
            header('Access-Control-Allow-Origin: *'); 
            readfile($filePath);
            exit;
        } else {
            throw new \Exception("Archivo no encontrado: {$category}/{$fileName}");
        }
    }

    /**
     * Procesa fonts.css inyectando el token de sesión en las rutas
     */
    private function serveProcessedFontsCss($token) {
        $filePath = dirname(__DIR__, 2) . "/private_assets/css/fonts.css";
        if (!file_exists($filePath)) throw new \Exception("fonts.css no encontrado");

        $content = file_get_contents($filePath);
        $domain = \Services\Config::getInstance()->get('domain');
        
        $callback = function($matches) use ($token, $domain) {
            $fontFile = basename($matches[1]);
            return "url('" . $domain . "/proxy/" . $token . "/fonts/" . $fontFile . "')";
        };

        $processedContent = preg_replace_callback("/url\(['\"]?.*?\/fonts\/(.*?\.(?:ttf|woff2|woff|svg))['\"]?\)/i", $callback, $content);

        header("Content-Type: text/css");
        echo $processedContent;
    }
}
