<?php

namespace Controllers;

/**
 * VideoController
 * Gestiona el guardado de videos renderizados en el servidor.
 * Accesible únicamente a través del AjaxGatewayController.
 *
 * Recibe upload BINARIO vía multipart/form-data (FormData desde JS).
 * Los headers de seguridad (X-Nonce, X-Action, X-Authorization-Key) 
 * los sigue validando el Gateway antes de despachar aquí.
 */
class VideoController extends Controller {

    /**
     * Tipos MIME permitidos para subida de video.
     * Se valida contra el contenido real del archivo (finfo), NO la extensión.
     */
    private const ALLOWED_MIME_TYPES = [
        'video/mp4'  => 'mp4',
        'video/webm' => 'webm',
        'video/quicktime' => 'mov',
    ];

    /** Tamaño máximo permitido: 500 MB */
    private const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

    public function defaultAction() {
        return ['success' => false, 'error' => 'Acceso no permitido directamente.'];
    }

    /**
     * Recibe un video binario via multipart/form-data y lo guarda en private_videos/.
     *
     * Campos esperados (FormData):
     *   - video_file  : File  — el binario del video (campo de archivo)
     *   - nombre      : string — nombre dado por el usuario
     *   - remate      : string — número/nombre del remate
     *   - lote        : string — número/nombre del lote
     *   - data_json   : string — JSON serializado del canvas (ya con valores reales, sin {{variables}})
     */
    private function saveAction() {
        $this->validarAcceso();

        // --- Leer campos de texto del multipart ---
        $nombreUsuario = isset($_POST['nombre'])    ? trim($_POST['nombre'])   : 'video';
        $remate        = isset($_POST['remate'])    ? trim($_POST['remate'])   : 'sin_remate';
        $lote          = isset($_POST['lote'])      ? trim($_POST['lote'])     : 'sin_lote';
        $dataJson      = isset($_POST['data_json']) ? trim($_POST['data_json']): '';

        // --- Validar que llegó el archivo ---
        if (!isset($_FILES['video_file']) || $_FILES['video_file']['error'] !== UPLOAD_ERR_OK) {
            $errCode = $_FILES['video_file']['error'] ?? -1;
            return ['success' => false, 'error' => "No se recibió el archivo de video (código: {$errCode})."];
        }

        $file = $_FILES['video_file'];

        // --- Validar tamaño ---
        if ($file['size'] > self::MAX_FILE_SIZE_BYTES) {
            return ['success' => false, 'error' => 'El archivo excede el tamaño máximo permitido (500 MB).'];
        }

        // --- Validar MIME real (desde el contenido binario, no la extensión) ---
        $finfo    = new \finfo(FILEINFO_MIME_TYPE);
        $mimeReal = $finfo->file($file['tmp_name']);

        if (!array_key_exists($mimeReal, self::ALLOWED_MIME_TYPES)) {
            return [
                'success' => false,
                'error'   => "Tipo de archivo no permitido ({$mimeReal}). Solo se aceptan: " . implode(', ', array_keys(self::ALLOWED_MIME_TYPES))
            ];
        }

        $extension = self::ALLOWED_MIME_TYPES[$mimeReal];

        // --- Sanitizar partes del nombre ---
        $sanitize = function(string $str): string {
            $str = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str) ?: $str;
            $str = strtolower(preg_replace('/[^a-zA-Z0-9_\-]/', '_', $str));
            return trim($str, '_') ?: 'valor';
        };

        $timestamp = time();
        $fileName  = sprintf(
            '%s_remate-%s_lote-%s_%d.%s',
            $sanitize($nombreUsuario),
            $sanitize($remate),
            $sanitize($lote),
            $timestamp,
            $extension
        );

        // --- Guardar en disco (movemos el temporal de PHP, 100% binario) ---
        $saveDir  = \Services\Config::getInstance()->get('document_root') . '/video_/private_videos/';
        $filePath = $saveDir . $fileName;

        if (!is_dir($saveDir)) {
            mkdir($saveDir, 0755, true);
        }

        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            return ['success' => false, 'error' => 'No se pudo mover el archivo al destino.'];
        }

        $fileSizeKb = round(filesize($filePath) / 1024);

        // --- Obtener el template_id del ACTIVE_TEMPLATE_ID si viene en POST ---
        $templateId = (int)($_POST['template_id'] ?? 0);

        // --- Guardar registro en BD con el JSON evaluado ---
        $idCliente = $_SESSION['usuario']['idClientes'] ?? 0;

        try {
            $this->base->executeStatement(
                "INSERT INTO video_renders 
                    (idClientes, template_id, data_json, nombre_usuario, remate, lote, nombre_archivo, tamano_kb, fecha_creacion) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                [
                    $idCliente,
                    $templateId,
                    $dataJson,        // JSON con valores reales resueltos
                    $nombreUsuario,
                    $remate,
                    $lote,
                    $fileName,
                    $fileSizeKb
                ]
            );
        } catch (\Exception $e) {
            // El archivo está guardado; reportamos warning pero no bloqueamos
            return [
                'success'        => true,
                'warning'        => 'Video guardado pero falló registro en BD: ' . $e->getMessage(),
                'nombre_archivo' => $fileName,
                'tamano_kb'      => $fileSizeKb
            ];
        }

        return [
            'success'        => true,
            'nombre_archivo' => $fileName,
            'tamano_kb'      => $fileSizeKb
        ];
    }

    /**
     * Función de prueba para disparar el Plan B (Node.js) manualmente.
     * Envía el ID solicitado al microservicio local.
     */
    public function testPlanBAction() {
        $renderId = 9; 

        $url = 'http://localhost:3001/render';
        $payload = json_encode(['renderId' => $renderId]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($payload)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error'   => 'No se pudo conectar con el servicio Node.js: ' . $error
            ];
        }

        return [
            'success'   => true,
            'http_code' => $httpCode,
            'node_resp' => json_decode($response, true)
        ];
    }
}
