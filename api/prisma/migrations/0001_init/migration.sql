CREATE TABLE `Usuarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(120) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `rol` ENUM('ADMIN', 'TEACHER', 'CLIENT') NOT NULL,
  `estado_mensualidad` ENUM('PAGADO', 'IMPAGADO') NOT NULL DEFAULT 'IMPAGADO',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `TiposClase` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(80) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tipos_clase_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `DispositivosPush` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `push_token` VARCHAR(191) NOT NULL,
  `plataforma` ENUM('IOS', 'ANDROID') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dispositivos_push_token` (`push_token`),
  KEY `idx_dispositivos_user_id` (`user_id`),
  CONSTRAINT `fk_dispositivos_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `Usuarios` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Clases` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(140) NOT NULL,
  `descripcion` TEXT NULL,
  `tipo_clase_id` INT NOT NULL,
  `teacher_id` INT NOT NULL,
  `capacidad_maxima` INT NOT NULL,
  `fecha_hora_inicio` DATETIME(3) NOT NULL,
  `fecha_hora_fin` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_clases_tipo_clase_id` (`tipo_clase_id`),
  KEY `idx_clases_teacher_id` (`teacher_id`),
  KEY `idx_clases_fecha_inicio` (`fecha_hora_inicio`),
  CONSTRAINT `fk_clases_tipo_clase_id`
    FOREIGN KEY (`tipo_clase_id`) REFERENCES `TiposClase` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_clases_teacher_id`
    FOREIGN KEY (`teacher_id`) REFERENCES `Usuarios` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_clases_capacidad_positiva` CHECK (`capacidad_maxima` > 0),
  CONSTRAINT `chk_clases_fechas_validas` CHECK (`fecha_hora_fin` > `fecha_hora_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Reservas` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `clase_id` INT NOT NULL,
  `estado` ENUM('CONFIRMADA', 'EN_ESPERA', 'ASISTENCIA_VALIDADA', 'NO_ASISTE', 'CANCELADA') NOT NULL,
  `fecha_solicitud` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reservas_user_clase` (`user_id`, `clase_id`),
  KEY `idx_reservas_clase_estado_fecha` (`clase_id`, `estado`, `fecha_solicitud`),
  KEY `idx_reservas_user_id` (`user_id`),
  CONSTRAINT `fk_reservas_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `Usuarios` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reservas_clase_id`
    FOREIGN KEY (`clase_id`) REFERENCES `Clases` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Penalizaciones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `tipo_clase_id` INT NOT NULL,
  `activa` BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`id`),
  KEY `idx_penalizaciones_user_tipo_activa` (`user_id`, `tipo_clase_id`, `activa`),
  CONSTRAINT `fk_penalizaciones_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `Usuarios` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penalizaciones_tipo_clase_id`
    FOREIGN KEY (`tipo_clase_id`) REFERENCES `TiposClase` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
