ALTER TABLE `Usuarios`
  ADD COLUMN `telefono` VARCHAR(30) NULL,
  ADD COLUMN `profile_picture` TEXT NULL;

ALTER TABLE `Clases`
  ADD COLUMN `image_url` TEXT NULL;

CREATE TABLE `ImageBank` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `keyword` VARCHAR(120) NOT NULL,
  `image_url` TEXT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_image_bank_keyword` (`keyword`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `SystemSettings` (
  `id` INT NOT NULL DEFAULT 1,
  `app_name` VARCHAR(120) NOT NULL DEFAULT 'Ronquillo Te Cuida',
  `hero_image` TEXT NULL,
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `SystemSettings` (`id`, `app_name`, `hero_image`)
VALUES (1, 'Ronquillo Te Cuida', 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1400&q=80')
ON DUPLICATE KEY UPDATE `app_name` = VALUES(`app_name`);
