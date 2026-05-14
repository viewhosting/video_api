<?php
/**
 * Bootstrap del sistema
 *
 * Configura el entorno, la zona horaria, la carga automática de clases
 * y el manejo de errores y sesiones.
 *
 * @author Emanuel Flores
 * @version 1.0
 */
error_reporting(0);
ini_set("display_errors", 0);
if(DEBUG) {
  error_reporting(E_ALL);
  ini_set("display_errors", 1);
}
$expire = 86400;
ini_set('session.cookie_lifetime', $expire);
ini_set('session.gc_maxlifetime', $expire);
ini_set('session.cookie_httponly', 1);
//ini_set('session.cookie_secure', 1);
//ini_set('session.save_handler', 'memcached');
//ini_set('session.save_path', 'localhost:11211');

session_set_cookie_params($expire);



session_start();

require_once 'vendor/autoload.php';

spl_autoload_register(function ($name) {
  
  try {
    $parts = explode("\\", $name);
    $file = ucfirst(array_pop($parts)) . ".php";
    $folders = "app/" . strtolower(implode("/", $parts));
    @include_once($folders. "/" . $file);
  } catch(\Throwable $th) {}
});

function debug($var, $end = true) {
  if(DEBUG) {
    echo "<pre>";
    var_dump($var);
    echo "</pre>";
    if($end) {
      die;
    }
  }
}