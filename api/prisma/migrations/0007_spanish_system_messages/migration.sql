UPDATE `NotificacionesAdmin` AS `notification`
LEFT JOIN `Usuarios` AS `user` ON `user`.`id` = `notification`.`user_id`
SET
  `notification`.`title` = CASE
    WHEN `notification`.`type` = 'PAYMENT_REPORTED' THEN 'Pago de mensualidad notificado'
    WHEN `notification`.`type` = 'MEMBERSHIP_EXPIRED' THEN 'Mensualidad caducada'
    ELSE `notification`.`title`
  END,
  `notification`.`message` = CASE
    WHEN `notification`.`type` = 'PAYMENT_REPORTED' THEN CONCAT(
      COALESCE(`user`.`nombre`, 'Un usuario'),
      ' ha notificado un pago. Revísalo y confírmalo para renovar su acceso.'
    )
    WHEN `notification`.`type` = 'MEMBERSHIP_EXPIRED' THEN CONCAT(
      'La mensualidad de ',
      COALESCE(`user`.`nombre`, 'un usuario'),
      ' ha caducado. No podrá reservar hasta que se renueve el pago.'
    )
    ELSE `notification`.`message`
  END
WHERE `notification`.`type` IN ('PAYMENT_REPORTED', 'MEMBERSHIP_EXPIRED');

UPDATE `PagosMensualidad`
SET `notes` = CASE
  WHEN `notes` = 'Payment reported from mobile app' THEN 'Pago notificado desde la aplicación móvil.'
  WHEN `notes` = 'Payment reported from web client dashboard' THEN 'Pago notificado desde la web.'
  WHEN `notes` = 'Manual renewal by admin' THEN 'Renovación manual realizada por un administrador.'
  ELSE `notes`
END
WHERE `notes` IN (
  'Payment reported from mobile app',
  'Payment reported from web client dashboard',
  'Manual renewal by admin'
);
