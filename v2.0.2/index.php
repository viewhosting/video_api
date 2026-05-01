<?php
/**
 * Punto de entrada principal de la aplicación.
 * 
 * Define constantes, carga el entorno y ejecuta la aplicación.
 */

// Activar o desactivar el modo debug
define("DEBUG", true);

// Carga de configuraciones y dependencias iniciales
require_once 'boostrap.php';

// Inicialización de la aplicación (Singleton)
$app = \App::getInstance();