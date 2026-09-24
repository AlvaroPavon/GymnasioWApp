# GimnasioWapp — Architecture Map

Ancla del proyecto. Antes de continuar en otro turno, revisá este mapa para no romper el contrato funcional.

## Stack fijado

- **Runtime**: Node.js `>=22.12 <25`; producción usa Node.js 24.21 LTS.
- **DB**: MySQL `8.0+`, tablas `ENGINE=InnoDB`, charset `utf8mb4`.
- **ORM**: Prisma ORM `6.19.3` security-pinned.
- **API**: Express 5, TypeScript ESM, JWT, Zod, Bcrypt, Helmet, CORS, rate limiting.
- **Jobs**: `node-cron`.
- **Push**: `expo-server-sdk` en API y `expo-notifications` en mobile.
- **Web**: React 19 + Vite 8 + TailwindCSS 4.
- **Mobile**: Expo SDK `57.0.24` + React Native `0.86.3` + React `19.2.3`, con nueva arquitectura.
- **Mobile release**: `app.config.js` dinámico + `eas.json` para builds/submits de App Store y Play Store.
- **Tests**: Jest 30 + Supertest en API; `node:test` para lógica móvil aislada.

## Estructura actual

```txt
GimnasioWapp/
├─ ARCHITECTURE_MAP.md
├─ README.md
├─ docs/PRODUCTION_OPERATIONS.md
├─ docs/STORE_RELEASE.md
├─ docker-compose.yml
├─ package.json
├─ database/init/001-create-test-db.sql
├─ api/
│  ├─ prisma/schema.prisma
│  ├─ prisma/seed.ts
│  ├─ prisma/migrations/0001_init/migration.sql
│  ├─ prisma/migrations/0002_reference_product/migration.sql
│  ├─ prisma/migrations/0003_memberships/migration.sql
│  ├─ prisma/migrations/0004_class_type_images/migration.sql
│  ├─ prisma/migrations/0005_reservation_promoted_at/migration.sql
│  ├─ prisma/migrations/0006_class_enrollment_preferences/migration.sql
│  ├─ Dockerfile
│  ├─ src/app.ts
│  ├─ src/server.ts
│  ├─ src/config/env.ts
│  ├─ src/db/prisma.ts
│  ├─ src/jobs/scheduler.ts
│  ├─ src/middleware/{auth,asyncHandler,errorHandler,upload,validate}.ts
│  ├─ src/routes/{auth,class,classType,imageBank,pushDevice,reservation,settings,user}.routes.ts
│  ├─ src/services/{auth,push,realtime,reservation,token}.service.ts
│  ├─ src/utils/{dto,time}.ts
│  ├─ docs/API.md
│  └─ tests/{cron,membership,reservations,users}.integration.test.ts
├─ web/
│  ├─ src/App.jsx
│  ├─ src/main.jsx
│  ├─ src/index.css
│  ├─ src/lib/api.js
│  ├─ src/context/AuthContext.jsx
│  ├─ src/pages/{Login,Dashboard}.jsx
│  └─ src/components/{AdminPanel,ClassDetailsModal,ClientCalendar,CreateUserModal,EditClassModal,TeacherPanel,UserProfileModal}.jsx
└─ mobile/
   ├─ App.js
   ├─ app.config.js
   ├─ eas.json
   ├─ index.js
   ├─ assets/{icon,adaptive-icon,notification-icon,splash}.png
   ├─ scripts/{validate-release-env,check-privacy-policy-link}.mjs
   ├─ store/privacy-policy-template.md
   ├─ src/api/{client.ts,config.js,realtime.js}
   ├─ src/components/activities/ActivityCalendar.js
   ├─ src/notifications/registerPushToken.ts
   ├─ src/release/runWithEnv.mjs
   ├─ src/auth/session.js
   ├─ src/screens/DashboardScreen.js
   ├─ src/utils/{activityCalendar,classSchedule,privacyPolicy,classTypeImageUpload}.js
   ├─ src/utils/activityCalendar.test.mjs
   └─ screens/{LoginScreen,DashboardScreen}.js
```

`mobile/App.js` es el punto de composición real: mantiene `screens/LoginScreen.js` para login e importa el dashboard activo desde `src/screens/DashboardScreen.js`. `screens/DashboardScreen.js` queda como implementación histórica y no debe recibir nuevas funcionalidades.

## Modelos DB obligatorios

- **Usuarios**: `id`, `nombre`, `email`, `password_hash`, `rol`, `estado_mensualidad`, `membership_expires_at`, `recordatorio_clase_activo`, más `telefono`, `profile_picture` para la UI clonada.
- **DispositivosPush**: `id`, `user_id`, `push_token` único, `plataforma`.
- **TiposClase**: `id`, `nombre`, `image_url`.
- **Clases**: `id`, `titulo`, `descripcion`, `tipo_clase_id`, `teacher_id`, `capacidad_maxima`, `fecha_hora_inicio`, `fecha_hora_fin`, más `image_url`.
- **Reservas**: `id`, `user_id`, `clase_id`, `estado`, `fecha_solicitud`, `ocultar_nombre`, `inscripcion_fija`, `recordatorio_enviado_en`.
- **Penalizaciones**: `id`, `user_id`, `tipo_clase_id`, `activa`.
- **ImageBank/SystemSettings**: soporte de imágenes y marca blanca de la app de referencia.
- **PagosMensualidad/NotificacionesAdmin**: reportes de pago, confirmación admin y avisos de vencimiento.

## Reglas críticas implementadas

1. Solo `CLIENT` con `estado_mensualidad = PAGADO` y `membership_expires_at` futuro puede reservar.
2. Si hay cupo: `CONFIRMADA`; si no: `EN_ESPERA`.
3. Reserva/cancelación/promoción usan transacción con `SELECT ... FOR UPDATE`.
4. Al liberar cupo se promociona primero a quien no tenga penalización activa para ese `tipo_clase_id`; luego por `fecha_solicitud`.
5. La promoción dispara push después del commit.
6. El cliente puede validar asistencia hasta 30 minutos antes.
7. Validar asistencia desactiva penalizaciones activas de ese tipo de clase.
8. Cron de validación marca `NO_ASISTE`, crea penalización y promueve lista de espera.
9. Cron de recordatorio envía un único push opt-in a los `CONFIRMADA`/`ASISTENCIA_VALIDADA` una hora antes y persiste el claim.
10. Admin y profesor propietario pueden quitar usuarios de una clase desde API y UI.
11. `ADMIN` y `TEACHER` no pagan cuota: quedan exentos y sin fecha de vencimiento.
12. Clientes pueden notificar pago; admin puede confirmar y renovar 1+ meses.
13. Cron de membresías caduca clientes vencidos y avisa al admin.
14. Admin puede restablecer contraseñas de usuarios desde web/mobile sin exponer `password_hash`.
15. Mobile debe mantener paridad funcional con web en detalle de clase: reservas, lista de espera, asistencia y gestión de alumnos adaptadas a pantalla móvil.
16. La imagen efectiva de una clase respeta `override de clase → imagen del tipo → banco legado`; el DTO expone por separado campos efectivos y `image_override_url`.
17. Al abrir Actividades, el calendario conserva hoy si tiene clases; si no, selecciona la próxima fecha con clases y usa la fecha pasada más reciente solo cuando no hay próximas.
18. Tipo de actividad y estado de reserva se aplican con la misma semántica en Calendario, Reservas y Lista de espera; `CLIENT` filtra su propia reserva y `ADMIN`/`TEACHER` filtran participantes visibles para gestión.
19. El dashboard usa safe areas en los cuatro bordes; los sheets calculan sus insets porque viven en un `Modal` fuera del árbol seguro de la pantalla.
20. Clientes pueden ocultar su identidad por reserva frente a otros clientes; admin y profesor conservan la identidad completa para gestionar la clase.
21. Admin y profesor pueden crear hasta 52 repeticiones semanales y asignar clientes pagados/futuros como inscripciones fijas en todas ellas.
22. La preferencia de recordatorio se guarda por usuario y la app registra el token push solo tras obtener permiso del sistema.

## Endpoints principales

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/push-devices`
- `GET /api/class-types`
- `POST /api/class-types`
- `PUT /api/class-types/:id` (`ADMIN`, JSON o `multipart/form-data` con campo `image`)
- `GET /api/classes`
- `POST /api/classes`
- `PUT /api/classes/:id`
- `DELETE /api/classes/:id`
- `POST /api/classes/:id/reserve` y `POST /api/classes/:id/cancel` (compatibilidad UI)
- `POST /api/classes/:classId/reservations`
- `PATCH /api/classes/:classId/reservations/privacy`
- `DELETE /api/classes/:classId/reservations/:userId`
- `POST /api/classes/:classId/attendance/validate`
- `POST /api/membership/payments`
- `GET /api/membership/payments/pending`
- `POST /api/membership/payments/:id/confirm`
- `POST /api/membership/users/:userId/renew`
- `GET /api/admin-notifications`
- `GET/PUT /api/settings`
- `GET/POST/DELETE /api/image-bank`
- `GET/POST/PUT/DELETE /api/users`
- `GET /api/users/eligible-clients`
- `PATCH /api/users/me/preferences`
- `PUT /api/users/:id/password`

## Tests obligatorios cubiertos

- Overbooking transaccional con capacidad 1.
- Bloqueo de reserva si mensualidad está `IMPAGADO`.
- Promoción de lista de espera priorizando no penalizados.
- Admin/profesor propietario quitando reservas y promoviendo espera.
- Conteo de ocupación sin contar lista de espera.
- Validación de asistencia y desactivación de penalizaciones.
- Bloqueo por mensualidad impagada o vencida.
- Reporte/confirmación de pago y renovación de fecha.
- Caducidad automática solo para clientes; staff exento.
- Cron de no-show + penalización + promoción.
- Cron de recordatorio push.
- Idempotencia persistente y opt-in del recordatorio push de una hora.
- Privacidad de asistentes por rol y actualización por reserva.
- Creación semanal con clientes fijos, deduplicación, validación de cuota y capacidad.
- Reset de contraseña por admin y bloqueo para usuarios no admin.
- Selección automática de fecha de actividad y fallback sin clases futuras.
- Filtros de tipo/estado por vista para `ADMIN`, `TEACHER` y `CLIENT` sin exponer identidades al cliente.

## Nota de producción

La migración `0006_class_enrollment_preferences` es aditiva y conserva los datos existentes. Añade preferencias y metadatos de reserva con valores por defecto seguros; nunca requiere reset ni seed.

Invariantes operativos:

- `/var/www/gimnasiowapp/current/api/uploads` apunta a `/var/www/gimnasiowapp/shared/uploads`.
- Cada deploy copia defaults ausentes a `shared/uploads/class-types` **antes** de cambiar el enlace `current`.
- Producción migra con backup restaurado/verificado y conteos pre/post; nunca usa Prisma reset ni seed, y debe conservar intactas las dos cuentas admin.
- Runbook completo: [`docs/PRODUCTION_OPERATIONS.md`](./docs/PRODUCTION_OPERATIONS.md).

## Publicación App Store / Play Store

- Configuración mobile store-ready en `mobile/app.config.js` y `mobile/eas.json`.
- `mobile/scripts/validate-release-env.mjs` bloquea releases sin API HTTPS real o con identificadores inválidos.
- `mobile/src/release/runWithEnv.mjs` carga `.env.production` antes de iniciar los scripts de validación/build/submit; no imprime valores ni contiene secretos.
- Guía operativa en `docs/STORE_RELEASE.md`.
- Política de privacidad base en `mobile/store/privacy-policy-template.md`; la URL canónica de Play y de la app es `https://ronquillotecuida.duckdns.org/privacy-policy.html`.
