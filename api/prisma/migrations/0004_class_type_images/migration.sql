ALTER TABLE `TiposClase`
  ADD COLUMN `image_url` TEXT NULL;

-- Rename Functional in place only when no canonical row exists; never merge or delete existing rows.
SET @legacy_functional_id = (
  SELECT `id` FROM `TiposClase` WHERE LOWER(`nombre`) = 'functional' LIMIT 1
);
SET @canonical_functional_id = (
  SELECT `id` FROM `TiposClase` WHERE LOWER(`nombre`) = 'entrenamiento funcional' LIMIT 1
);
UPDATE `TiposClase`
SET
  `nombre` = 'Entrenamiento funcional',
  `image_url` = COALESCE(`image_url`, '/uploads/class-types/entrenamiento-funcional.jpg')
WHERE `id` = @legacy_functional_id
  AND @canonical_functional_id IS NULL;

INSERT INTO `TiposClase` (`nombre`, `image_url`)
SELECT 'Entrenamiento funcional', '/uploads/class-types/entrenamiento-funcional.jpg'
WHERE NOT EXISTS (
  SELECT 1 FROM `TiposClase` WHERE LOWER(`nombre`) = 'entrenamiento funcional'
);

UPDATE `TiposClase`
SET `image_url` = COALESCE(`image_url`, '/uploads/class-types/entrenamiento-funcional.jpg')
WHERE LOWER(`nombre`) IN ('functional', 'entrenamiento funcional');

INSERT INTO `TiposClase` (`nombre`, `image_url`)
VALUES
  ('Yoga', '/uploads/class-types/yoga.jpg'),
  ('Pilates', '/uploads/class-types/pilates.jpg')
ON DUPLICATE KEY UPDATE
  `image_url` = COALESCE(`image_url`, VALUES(`image_url`));
