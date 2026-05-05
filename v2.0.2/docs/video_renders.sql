-- =======================================================
-- Tabla: video_renders
-- Registra cada video renderizado y guardado en el servidor
-- =======================================================
CREATE TABLE IF NOT EXISTS `video_renders` (
  `id`              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `idClientes`      INT UNSIGNED     NOT NULL DEFAULT 0     COMMENT 'ID del cliente que generó el video',
  `template_id`     INT UNSIGNED     NOT NULL DEFAULT 0     COMMENT 'ID del template JSON utilizado',
  `nombre_usuario`  VARCHAR(255)     NOT NULL DEFAULT ''    COMMENT 'Nombre dado por el usuario al video',
  `remate`          VARCHAR(255)     NOT NULL DEFAULT ''    COMMENT 'Nombre o número del remate/evento',
  `lote`            VARCHAR(255)     NOT NULL DEFAULT ''    COMMENT 'Número o categoría del lote',
  `nombre_archivo`  VARCHAR(512)     NOT NULL DEFAULT ''    COMMENT 'Nombre del archivo guardado en private_videos/',
  `tamano_kb`       INT UNSIGNED     NOT NULL DEFAULT 0     COMMENT 'Tamaño del archivo en kilobytes',
  `fecha_creacion`  DATETIME         NOT NULL               COMMENT 'Fecha y hora de generación del video',
  `activo`          TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_cliente`  (`idClientes`),
  KEY `idx_template` (`template_id`),
  KEY `idx_fecha`    (`fecha_creacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro de videos renderizados';
