<?php

namespace Controllers;

/**
 * Controlador Run
 * Encargado de la ejecución de procesos de video/API.
 */
class CorrerController extends Controller {
    
    public function __construct($params = []) {
        parent::__construct($params);
    }

    /**
     * Acción por defecto
     */
    public function defaultAction() {
        
        // echo '<pre>';
        // print_r($_SESSION);
        // print_r($this->cliente_actual);
        // echo '</pre>';

        // print_r(\Services\Config::getInstance()->get('domain'));
        // exit;
        

        // Validar acceso antes de ejecutar
        $this->validarAcceso();

        // 1. Obtener ID del cliente actual (asumiendo que está en la sesión o en la propiedad cliente_actual)
        $idCliente = $_SESSION['usuario']['idClientes'] ?? ($this->cliente_actual['id'] ?? 0);

        // 2. Consultar templates del cliente en la DB
        $templates = $this->base->fetchAllAssociative(
            "SELECT id, nombre, thumbnail_base64, data_json FROM video_templates WHERE idClientes = ? AND activo = 1 ORDER BY fecha_creacion DESC",
            [$idCliente]
        );

        // 3. Generamos un token simple para la sesión
        $token = $this->generarUUIDv4();
        $_SESSION['proxy_token'] = $token;
        $_SESSION['proxy_token_expire'] = time() + 3600;

        $proxyBase = \Services\Config::getInstance()->get('domain') . "/proxy/" . $token;
        $publicBase = \Services\Config::getInstance()->get('domain') . "/ffmpeg/lib"; // Ruta pública fija para caché

        // Definimos las rutas de assets
        $assets = [
            'url_js_protegido'   => $proxyBase . "/js/main.js",
            'css_fonts'          => $proxyBase . "/css/fonts.css",
            // Estos archivos ahora son estáticos y se cachean en el navegador:
            'js_ffmpeg'          => $publicBase . "/ffmpeg.js",
            'js_util'            => $publicBase . "/util.js",
            'js_ffmpeg_core'     => $publicBase . "/ffmpeg-core.js",
            'wasm_ffmpeg_core'   => $publicBase . "/ffmpeg-core.wasm",
            'worker_ffmpeg_core' => $publicBase . "/ffmpeg-core.worker.js",
            'templates'          => $templates
        ];

   //     print_r($templates);
//        exit;

        // Renderizar la vista 'run' pasando los assets
        $this->render('view/run', $assets);
    }

    /**
     * Ejemplo de una acción secundaria: /run/status
     */
    public function statusAction() {
        $this->validarAcceso();
        
        echo json_encode([
            'status' => 'success',
            'process_status' => 'idle',
            'trace' => $this->trace_id
        ]);
    }
}
