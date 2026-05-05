<?php

namespace Controllers;

/**
 * VideoController
 * Gestiona el guardado de videos renderizados en el servidor.
 * Accesible únicamente a través del AjaxGatewayController.
 */
class VideoController extends Controller {

    public function defaultAction() {
        // Esta acción no es de uso directo
        return ['success' => false, 'error' => 'Acceso no permitido directamente.'];
    }

    /**
     * Recibe un video en base64 o binario y lo guarda en private_videos/.
     * Espera los siguientes campos en el body JSON:
     *   - nombre       : string  — nombre dado por el usuario
     *   - video_base64 : string  — video en base64 (data:video/mp4;base64,...)
     *   - template_id  : int     — ID del template JSON utilizado
     *   - remate       : string  — número/nombre del remate
     *   - lote         : string  — número/nombre del lote
     */
    private function saveAction() {
        $this->validarAcceso();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data) {
            return ['success' => false, 'error' => 'Payload inválido.'];
        }

        $nombreUsuario  = $data['nombre']       ?? 'video';
        $videoBase64    = $data['video_base64']  ?? '';
        $templateId     = (int)($data['template_id'] ?? 0);
        $remate         = $data['remate']        ?? 'sin_remate';
        $lote           = $data['lote']          ?? 'sin_lote';

        if (empty($videoBase64)) {
            return ['success' => false, 'error' => 'No se recibió el video.'];
        }

        // --- Sanitizar partes del nombre ---
        $sanitize = function(string $str): string {
            $str = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str);
            $str = strtolower(preg_replace('/[^a-zA-Z0-9_\-]/', '_', $str));
            return trim($str, '_');
        };

        $nombreSanitized = $sanitize($nombreUsuario);
        $remateSanitized = $sanitize($remate);
        $loteSanitized   = $sanitize($lote);
        $timestamp       = time();

        // Formato: nombre_remate-REMATE_lote-LOTE_tpl-TEMPLATE_ID_1746123456.mp4
        $fileName = sprintf(
            '%s_remate-%s_lote-%s_tpl-%d_%d.mp4',
            $nombreSanitized,
            $remateSanitized,
            $loteSanitized,
            $templateId,
            $timestamp
        );

        // --- Decodificar base64 ---
        // Soporta data URI: "data:video/mp4;base64,XXXXX" o base64 puro
        if (strpos($videoBase64, ';base64,') !== false) {
            [, $videoBase64] = explode(';base64,', $videoBase64);
        }
        $videoBinary = base64_decode(str_replace(' ', '+', $videoBase64));
        if ($videoBinary === false || strlen($videoBinary) < 100) {
            return ['success' => false, 'error' => 'Decodificación de video fallida.'];
        }

        // --- Guardar en disco ---
        $saveDir  = \Services\Config::getInstance()->get('document_root') . '/video_/v2.0.2/private_videos/';
        $filePath = $saveDir . $fileName;

        if (!is_dir($saveDir)) {
            mkdir($saveDir, 0755, true);
        }

        if (file_put_contents($filePath, $videoBinary) === false) {
            return ['success' => false, 'error' => 'No se pudo escribir el archivo en el servidor.'];
        }

        $fileSizeKb = round(filesize($filePath) / 1024);

        // --- Guardar registro en BD ---
        $idCliente = $_SESSION['usuario']['idClientes'] ?? 0;

        try {
            $this->base->executeStatement(
                "INSERT INTO video_renders 
                    (idClientes, template_id, nombre_usuario, remate, lote, nombre_archivo, tamano_kb, fecha_creacion) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
                [
                    $idCliente,
                    $templateId,
                    $nombreUsuario,
                    $remate,
                    $lote,
                    $fileName,
                    $fileSizeKb
                ]
            );
        } catch (\Exception $e) {
            // Si falla la BD, el archivo ya está guardado, lo reportamos pero no bloqueamos
            return [
                'success'       => true,
                'warning'       => 'Video guardado pero fallo registro en BD: ' . $e->getMessage(),
                'nombre_archivo' => $fileName,
                'tamano_kb'     => $fileSizeKb
            ];
        }

        return [
            'success'        => true,
            'nombre_archivo' => $fileName,
            'tamano_kb'      => $fileSizeKb
        ];
    }
}
