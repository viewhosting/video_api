<?php

namespace Controllers;

/**
 * VideoController
 * Gestiona el guardado de videos renderizados y disparos del Plan B.
 */
class VideoController extends Controller {

    private const ALLOWED_MIME_TYPES = [
        'video/mp4'  => 'mp4',
        'video/webm' => 'webm',
        'video/quicktime' => 'mov',
    ];

    private const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

    /**
     * Constructor: Guardia global de seguridad.
     */
    public function __construct() {
        parent::__construct();
        $this->validarAcceso();
    }

    public function defaultAction() {
        return ['success' => false, 'error' => 'Acceso no permitido directamente.'];
    }

    /**
     * Recibe subida binaria. Invocado como 'Video@save'
     */
    protected function saveAction() {
        // --- Leer campos del multipart ---
        $nombreUsuario = isset($_POST['nombre'])    ? trim($_POST['nombre'])   : 'video';
        $remate        = isset($_POST['remate'])    ? trim($_POST['remate'])   : 'sin_remate';
        $lote          = isset($_POST['lote'])      ? trim($_POST['lote'])     : 'sin_lote';
        $dataJson      = isset($_POST['data_json']) ? trim($_POST['data_json']): '';

        if (!isset($_FILES['video_file']) || $_FILES['video_file']['error'] !== UPLOAD_ERR_OK) {
            return ['success' => false, 'error' => "No se recibió el archivo."];
        }

        $file = $_FILES['video_file'];
        if ($file['size'] > self::MAX_FILE_SIZE_BYTES) {
            return ['success' => false, 'error' => 'Excede tamaño permitido.'];
        }

        $finfo    = new \finfo(FILEINFO_MIME_TYPE);
        $mimeReal = $finfo->file($file['tmp_name']);

        if (!array_key_exists($mimeReal, self::ALLOWED_MIME_TYPES)) {
            return ['success' => false, 'error' => "MIME no permitido ({$mimeReal})."];
        }

        $extension = self::ALLOWED_MIME_TYPES[$mimeReal];

        $sanitize = function(string $str): string {
            $str = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str) ?: $str;
            $str = strtolower(preg_replace('/[^a-zA-Z0-9_\-]/', '_', $str));
            return trim($str, '_') ?: 'valor';
        };

        $fileName  = sprintf('%s_remate-%s_lote-%s_%d.%s', $sanitize($nombreUsuario), $sanitize($remate), $sanitize($lote), time(), $extension);
        $saveDir   = \Services\Config::getInstance()->get('document_root') . '/video_/private_videos/';
        $filePath  = $saveDir . $fileName;

        if (!is_dir($saveDir)) mkdir($saveDir, 0755, true);

        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            return ['success' => false, 'error' => 'Error al mover archivo.'];
        }

        $fileSizeKb = round(filesize($filePath) / 1024);
        $templateId = (int)($_POST['template_id'] ?? 0);
        $idCliente  = $_SESSION['usuario']['idClientes'] ?? 0;

        try {
            $this->base->executeStatement(
                "INSERT INTO video_renders (idClientes, template_id, data_json, nombre_usuario, remate, lote, nombre_archivo, tamano_kb, fecha_creacion) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                [$idCliente, $templateId, $dataJson, $nombreUsuario, $remate, $lote, $fileName, $fileSizeKb]
            );
        } catch (\Exception $e) {
            return ['success' => true, 'warning' => 'DB Error: ' . $e->getMessage(), 'nombre_archivo' => $fileName];
        }

        return ['success' => true, 'nombre_archivo' => $fileName, 'tamano_kb' => $fileSizeKb];
    }

    /**
     * Lanza renderizado Plan B. Invocado como 'Video@testPlanB'
     */
    protected function testPlanBAction() {
        $renderId = (int)($_POST['renderId'] ?? 9); 

        $url = 'http://localhost:3001/render';
        $payload = json_encode(['renderId' => $renderId]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Content-Length: ' . strlen($payload)]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);

        $response = curl_exec($ch);
        curl_close($ch);

        return ['success' => true, 'node_resp' => json_decode($response, true)];
    }
}
