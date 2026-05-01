<?php

namespace Controllers;

class TemplatesController extends Controller {

    public function saveAction() {
        $this->validarAcceso();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['nombre'])) {
            $this->jsonResponse(['success' => false, 'error' => 'Datos incompletos']);
        }

        $idCliente = $_SESSION['usuario']['idClientes'] ?? ($this->cliente_actual['id'] ?? 0);

        try {
            $this->base->executeStatement(
                "INSERT INTO video_templates (idClientes, nombre, data_json, thumbnail_base64) VALUES (?, ?, ?, ?)",
                [$idCliente, $data['nombre'], $data['data_json'], $data['thumbnail']]
            );
            $this->jsonResponse(['success' => true]);
        } catch (\Exception $e) {
            $this->jsonResponse(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    public function updateAction() {
        $this->validarAcceso();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['id'])) {
            $this->jsonResponse(['success' => false, 'error' => 'ID no proporcionado']);
        }

        try {
            $this->base->executeStatement(
                "UPDATE video_templates SET data_json = ?, thumbnail_base64 = ? WHERE id = ?",
                [$data['data_json'], $data['thumbnail'], $data['id']]
            );
            $this->jsonResponse(['success' => true]);
        } catch (\Exception $e) {
            $this->jsonResponse(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    public function duplicateAction() {
        $this->validarAcceso();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['id'])) {
            $this->jsonResponse(['success' => false, 'error' => 'ID no proporcionado']);
        }

        try {
            $original = $this->base->fetchAssociative("SELECT * FROM video_templates WHERE id = ?", [$data['id']]);
            if ($original) {
                $this->base->executeStatement(
                    "INSERT INTO video_templates (idClientes, nombre, data_json, thumbnail_base64) VALUES (?, ?, ?, ?)",
                    [$original['idCliente'], $original['nombre'] . ' (Copia)', $original['data_json'], $original['thumbnail_base64']]
                );
                $this->jsonResponse(['success' => true]);
            }
        } catch (\Exception $e) {
            $this->jsonResponse(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    public function deleteAction() {
        $this->validarAcceso();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['id'])) {
            $this->jsonResponse(['success' => false, 'error' => 'ID no proporcionado']);
        }

        try {
            $this->base->executeStatement("UPDATE video_templates SET activo = 0 WHERE id = ?", [$data['id']]);
            $this->jsonResponse(['success' => true]);
        } catch (\Exception $e) {
            $this->jsonResponse(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    private function jsonResponse($data) {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
