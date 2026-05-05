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

        // 4. Generamos Nonce inicial para AJAX
        $nonce = bin2hex(random_bytes(16));
        $_SESSION['nonce_ajax'] = $nonce;
        $encryptedNonce = $this->_encriptar($nonce);
        $authKey = \Services\Config::getInstance()->get('authorization_key');

        // 5. NUEVO TOKEN PARA RE-APERTURA (Mismo formato que AccesoController)
        $newReopenNonce = bin2hex(random_bytes(16));
        $_SESSION['video_nonce'] = $newReopenNonce;
        $reopenPayload = time() . "|$newReopenNonce";
        $reopenToken = $this->_encriptar($reopenPayload);

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
            'encrypted_nonce'    => $encryptedNonce,
            'authorization_key'  => $authKey,
            'reopen_token'       => $reopenToken,
            'templates'          => $templates,
            'variables'          => [
                                        'dinamicas' => [        
                                            'ESCRITORIO' => 'lote21',
                                            'VIDEO_URL' => 'https://www.cdev.mx/input.mp4',
                                            'AUDIO_URL' => '',
                                            'LOGO_URL' => 'https://www.cdev.mx/logo.png',
                                            'ARCHIVO' => 'render_remoto.mp4',
                                            'PLANTILLA' => 'Ejemplo 1',
                                            "TELEFONOS_CONTACTO"=>"098 702 484  099 724 117   092 689 695",
                                            "LOT_NUMERO"=>"Lote 19",
                                            "CATEGORIA_GANADO"=>"TERNEROS",
                                            "CANTIDAD_CABEZAS"=>"64",
                                            "PESO_PROMEDIO"=>"168",
                                            "CLASE"=>"BMB",
                                            "ESTADO"=>"BMB",
                                            "PARAJE"=>"Piedras Coloradas",
                                            'LATITUD'=>"-34.89122",
                                            'LONGITUD'=>"-66.85496",
                                            "DEPARTAMENTO"=>"Paysandú",
                                            'TEXTO_1'=>"Se vende ternero de un año y dos meses esta muy bien de cría y tiene buen estado de doma",
                                            "TEXTO_2"=>""
                                        ],
                                        'fijas' => [
                                            'copyright' => '@2026 Cdev.mx. Todos los derechos reservados.',
                                            'redes_sociales' => '@CDMX   @lote21mx   @lote21mx'
                                        ]
            ]
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
