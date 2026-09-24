ALTER TABLE `Usuarios`
  ADD COLUMN `recordatorio_clase_activo` BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE `Reservas`
  ADD COLUMN `ocultar_nombre` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `inscripcion_fija` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `recordatorio_enviado_en` DATETIME(3) NULL;

CREATE INDEX `idx_reservas_recordatorio`
  ON `Reservas`(`estado`, `recordatorio_enviado_en`, `clase_id`);
