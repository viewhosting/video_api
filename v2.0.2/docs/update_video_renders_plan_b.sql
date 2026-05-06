-- Actualización para soportar Plan B (Renderizado asíncrono)
ALTER TABLE `video_renders` 
ADD COLUMN `estado` ENUM('pendiente', 'procesando', 'completado', 'error') NOT NULL DEFAULT 'completado' AFTER `activo`,
ADD COLUMN `error_msg` TEXT NULL AFTER `estado`;

-- Nota: Ponemos default 'completado' para que los registros del Plan A
-- (que se guardan ya listos) no se vean como pendientes.
