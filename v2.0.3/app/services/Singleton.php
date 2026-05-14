<?php

namespace Services;

/**
 * Clase abstracta para implementar el patrón Singleton.
 * Evita instanciación múltiple y garantiza una única instancia.
 */
abstract class Singleton
{
    /**
     * Instancia única de la clase.
     *
     * @var static|null
     */
    private static ?self $instance = null;

    /**
     * Constructor protegido para permitir herencia y evitar instanciación externa.
     */
    protected function __construct()
    {
        // Protección contra instanciación directa desde afuera.
    }

    /**
     * Previene la clonación del objeto.
     */
    private function __clone(): void
    {
        // Protección contra clonación
    }

    /**
     * Devuelve la instancia única de la clase.
     *
     * @return static
     */
    final public static function instance(): static
    {
        if (static::$instance === null) {
            static::$instance = new static();
        }

        return static::$instance;
    }

    /**
     * Alias de `instance()`
     *
     * @return static
     */
    final public static function getInstance(): static
    {
        return static::instance();
    }

    /**
     * Alias legado de `instance()`. No se recomienda usar.
     *
     * @deprecated Usa getInstance() en su lugar.
     * @return static
     */
    final public static function get_instance(): static
    {
        return static::instance();
    }
}