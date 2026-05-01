<?php

namespace Controllers;

use Exception;
use \DateTime;
use \DateTimeZone;
/**
 * Controlador por defecto 
 */
class DefaultController extends Controller {
	
	/**
	 * Constructor del controlador
	 *
	 * @param array $params Parámetros de la URL
	 */
	public function __construct($params = []) {
		parent::__construct($params);
	}

	/**
	 * Acción por defecto
	 *
	 * @return void
	 */
	public function defaultAction(): void {
		$this->validarAcceso();
		echo json_encode([
			'status' => 'success',
			'message' => 'API Base Core v2.0.2'
		]);
	}

	/**
	 * Manejo de rutas no encontradas
	 *
	 * @return void
	 */
	public function notFoundAction(): void {
		http_response_code(404);
		echo json_encode([
			'status' => 'error',
			'message' => 'Ruta no encontrada'
		]);
		exit;
	}
}