<?php

/**
 * Clase principal de la aplicación.
 *
 * Se encarga de:
 * - Inicializar la conexión a base de datos
 * - Determinar y cargar el controlador correspondiente
 * - Ofrecer acceso singleton a la conexión
 * - Cargar controladores dinámicamente según la URL
 * 
 * @author TuNombre
 */
class App extends \Services\Singleton {
  
    /**
     * Instancia del controlador que se está ejecutando.
     * 
     * @var object|null
     */
    private $_controller;

    /**
     * Parámetros adicionales de la URL
     * 
     * @var array
     */
    private $_params;

    /**
     * Conexión a base de datos (doctrine DBAL)
     * 
     * @var \Doctrine\DBAL\Connection|null
     */
    private static $_connection;
    
    /**
     * Conexión a base de datos Externa (doctrine DBAL)
     * 
     * @var \Doctrine\DBAL\Connection|null
     */
    private static $_connection_externa;

    /**
     * Constructor protegido del Singleton
     */
    protected function __construct() {
        $this->_startDB();
        $this->_controller = $this->_getController();
    }

    /**
     * Determina qué controlador debe ejecutarse según la URL.
     * 
     * @return object|null Instancia del controlador
     */
    private function _getController() {
        $params = ['default'];
        
        // Analiza la URL (por ejemplo: index.php?q=chat/start)
        if (isset($_GET['q']) && !empty($_GET['q'])) {
            $params = explode("/", $_GET['q']);
        }

        $original_params = $params;
        $controllerName = "\Controllers\\" . ucfirst(strtolower(array_shift($params))) . "Controller";
       //echo $controllerName;
        try {
            if (class_exists($controllerName)) {
         //       print_r($params);
       
                return new $controllerName($params);
            } else {
                // Carga el controlador por defecto si no existe
                //echo 'Carga el controlador por defecto si no existe';
              //  print_r($original_params);
                return new \Controllers\DefaultController($original_params);
            }
        } catch (\Throwable $th) {
            if (DEBUG) {
                debug($th);
            }
            return null;
        }
    }

    /**
     * Inicia una conexión a la base de datos local.
     *
     * @return \Doctrine\DBAL\Connection
     */
    private function _startDB() {
        if (self::$_connection === null) {
            $connectionParams = [
                'dbname'   => \Services\Config::getInstance()->get('db_name'),
                'user'     => \Services\Config::getInstance()->get('db_username'),
                'password' => \Services\Config::getInstance()->get('db_password'),
                'host'     => \Services\Config::getInstance()->get('db_host'),
                'driver'   => 'mysqli',
            ];
            self::$_connection = \Doctrine\DBAL\DriverManager::getConnection($connectionParams);
        }

        return self::$_connection;
    }

    /**
     * Inicia una conexión a la base de datos externa/remota.
     * 
     * @return \Doctrine\DBAL\Connection
     */
    private function _startDBEXT() {
        if (self::$_connection_externa === null) {
            $connectionParams = [
                'dbname'   => \Services\Config::getInstance()->get('db_name_remote'),
                'user'     => \Services\Config::getInstance()->get('db_username_remote'),
                'password' => \Services\Config::getInstance()->get('db_password_remote'),
                'host'     => \Services\Config::getInstance()->get('db_host_remote'),
                'driver'   => 'mysqli',
            ];
            self::$_connection_externa = \Doctrine\DBAL\DriverManager::getConnection($connectionParams);
        }

        return self::$_connection_externa;
    }

    /**
     * Obtiene la conexión actual a la base de datos local.
     * 
     * @return \Doctrine\DBAL\Connection
     */
    public static function getDB() {
        if (self::$_connection === null) {
            self::getInstance()->_startDB();
        }
        return self::$_connection;
    }

    /**
     * Obtiene la conexión actual a la base de datos externa/remota.
     * 
     * @return \Doctrine\DBAL\Connection
     */
    public static function getDBEXT() {
        if (self::$_connection_externa === null) {
            self::getInstance()->_startDBEXT();
        }
        return self::$_connection_externa;
    }
}