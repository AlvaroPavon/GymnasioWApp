ALTER TABLE `Usuarios`
  ADD COLUMN `membership_expires_at` DATETIME(3) NULL;

CREATE TABLE `PagosMensualidad` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `amount_cents` INT NULL,
  `status` ENUM('PENDING_ADMIN_REVIEW', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PENDING_ADMIN_REVIEW',
  `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewed_by_id` INT NULL,
  `reviewed_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_pagos_user_status` (`user_id`, `status`),
  KEY `idx_pagos_status_created` (`status`, `created_at`),
  KEY `idx_pagos_reviewed_by_id` (`reviewed_by_id`),
  CONSTRAINT `fk_pagos_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `Usuarios` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pagos_reviewed_by_id`
    FOREIGN KEY (`reviewed_by_id`) REFERENCES `Usuarios` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `NotificacionesAdmin` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `type` ENUM('PAYMENT_REPORTED', 'MEMBERSHIP_EXPIRED') NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `message` TEXT NOT NULL,
  `user_id` INT NULL,
  `payment_id` INT NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_notificaciones_read_created` (`read_at`, `created_at`),
  KEY `idx_notificaciones_type_created` (`type`, `created_at`),
  KEY `idx_notificaciones_user_id` (`user_id`),
  KEY `idx_notificaciones_payment_id` (`payment_id`),
  CONSTRAINT `fk_notificaciones_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `Usuarios` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notificaciones_payment_id`
    FOREIGN KEY (`payment_id`) REFERENCES `PagosMensualidad` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
