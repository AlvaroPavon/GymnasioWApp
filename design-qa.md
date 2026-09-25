# Design QA — tema unificado 1.0.2

## Dirección visual

- Referencia funcional: mantener los flujos, permisos y vistas existentes.
- Referencia estética: calendario oscuro actual, login glass/dorado y transición de splash suministrados por el cliente.
- Sistema aplicado: fondo obsidiana, superficies carbón/navy, acento dorado, coral y colores semánticos reservados para estados.

## Cobertura

- Web: login, shell, navegación por rol, clases, usuarios, pagos, métricas, ajustes, modales y calendario.
- Android/iOS: splash, login, dashboard, dock por rol, calendario, formularios, sheets y estados de sincronización.
- Accesibilidad: foco visible, etiquetas de controles, contraste, safe areas y reducción de movimiento.

## Evidencia ejecutada

- Login web comprobado en escritorio y ancho móvil.
- Dashboard ADMIN autenticado comprobado en escritorio y ancho móvil.
- Cambio animado entre `Clases` y `Usuarios` comprobado sin errores de consola.
- API local recuperada y `/health` devuelve HTTP 200.
- API: 17 suites, 101 pruebas superadas.
- Web: 23 pruebas y build de producción superados.
- Mobile: 26 pruebas, TypeScript y Expo Doctor 17/17 superados.
- Bundles Metro exportados correctamente para Android e iOS.
- Auditoría de dependencias de producción: 0 vulnerabilidades conocidas.
- APK preview final `1.0.2` (`versionCode 14`) generado por EAS: build `4092d5fa-79fa-4e69-960f-84b0d9633d88`.
- SHA-256 del APK validado: `129FFD1141A239C6E9F7C2B2FD90EF3E11BC9328D79CD2482C3E13B7B6402BCD`.
- APK instalado con actualización in-place en el Samsung SM-S931B (Android 16), conservando la fecha de primera instalación y los datos locales.
- Arranque en frío, sesión recordada, calendario y navegación por las seis secciones ADMIN comprobados en el dispositivo físico.
- Dock inferior validado sin recortes y por encima de la navegación del sistema; `Clases`, `Usuarios`, `Pagos`, `Imágenes`, `Ajustes` y `Métricas` quedan visibles.
- Detalle y edición de clase comprobados sin guardar cambios; el teclado permaneció abierto y el campo mantuvo el foco al escribir carácter a carácter.
- Cierre del formulario verificado sin persistir el texto de prueba y sin alterar datos de producción.
- `logcat` sin errores `AndroidRuntime` ni `ReactNativeJS` durante la ejecución focal.

## Preparación de publicación

- La QA física Android y la verificación automatizada están completas.
- Los binarios AAB e IPA firmados se generan después de sincronizar el repositorio y desplegar la web, sin envío automático a las tiendas.

**Resultado actual:** aprobado a nivel de código, web, bundles y dispositivo Android físico; listo para preparar los artefactos firmados de tienda.
