<?php

namespace Controllers;

/**
 * TemplatesController
 * Gestiona el CRUD de plantillas de video.
 * Las acciones son invocadas vía AjaxGatewayController con ofuscación.
 */
class TemplatesController extends Controller {

    /**
     * Constructor: Centraliza la seguridad para todas las acciones de este controlador.
     */
    public function __construct() {
        parent::__construct();
        // Guardia global: si falla, detiene la ejecución antes de llegar a cualquier método.
        $this->validarAcceso();
    }

    public function defaultAction() {
        // No hace nada por ahora
    }

    /**
     * Guarda un nuevo diseño. Invocado como 'Templates@save'
     */
    protected function saveAction() {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['nombre'])) {
            return $this->jsonResponse(['success' => false, 'error' => 'Datos incompletos']);
        }

        $idCliente = $_SESSION['usuario']['idClientes'] ?? ($this->cliente_actual['id'] ?? 0);

        try {
            $this->base->executeStatement(
                "INSERT INTO video_templates (idClientes, nombre, data_json, thumbnail_base64) VALUES (?, ?, ?, ?)",
                [$idCliente, $data['nombre'], $data['data_json'], $data['thumbnail']]
            );
            return $this->jsonResponse(['success' => true]);
        } catch (\Exception $e) {
            return $this->jsonResponse(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Actualiza un diseño existente. Invocado como 'Templates@update'
     */
    protected function updateAction() {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['id'])) {
            return $this->jsonResponse(['success' => false, 'error' => 'ID no proporcionado']);
        }

        try {
            $this->base->executeStatement(
                "UPDATE video_templates SET data_json = ?, thumbnail_base64 = ? WHERE id = ?",
                [$data['data_json'], $data['thumbnail'], $data['id']]
            );
            return $this->jsonResponse(['success' => true]);
        } catch (\Exception $e) {
            return $this->jsonResponse(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Duplica una plantilla. Invocado como 'Templates@duplicate'
     */
    protected function duplicateAction() {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = (int)($data['id'] ?? 0);

        if (!$id) return $this->jsonResponse(['success' => false, 'error' => 'ID inválido']);

        try {
            $template = $this->base->fetchRow("SELECT * FROM video_templates WHERE id = ?", [$id]);
            if (!$template) throw new \Exception("Plantilla no encontrada");

            $this->base->executeStatement(
                "INSERT INTO video_templates (idClientes, nombre, data_json, thumbnail_base64) VALUES (?, ?, ?, ?)",
                [$template['idClientes'], $template['nombre'] . ' (Copia)', $template['data_json'], $template['thumbnail_base64']]
            );
            return $this->jsonResponse(['success' => true]);
        } catch (\Exception $e) {
            return $this->jsonResponse(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Borrado lógico. Invocado como 'Templates@delete'
     */
    protected function deleteAction() {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = (int)($data['id'] ?? 0);

        if (!$id) return $this->jsonResponse(['success' => false, 'error' => 'ID inválido']);

        try {
            $this->base->executeStatement("UPDATE video_templates SET activo = 0 WHERE id = ?", [$id]);
            return $this->jsonResponse(['success' => true]);
        } catch (\Exception $e) {
            return $this->jsonResponse(['success' => false, 'error' => $e->getMessage()]);
        }
    }
}
