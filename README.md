# GimnasioWapp

Sistema de gestión de clases de gimnasio en monorepo. Replica la interfaz de `AlvaroPavon/GymnasioWApp` y suma las reglas críticas: reservas transaccionales, lista de espera, penalizaciones, asistencia, push y cron jobs.

## Quick path

```bash
npm install
copy api\.env.example api\.env

docker compose up -d
npm -w api run prisma:migrate:deploy
npm -w api run prisma:seed

npm run api:dev
npm run web:dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`

El seed anterior es solo para desarrollo local. En producción no se ejecuta seed ni reset; seguí el [runbook de operación segura](./docs/PRODUCTION_OPERATIONS.md).

### API opcional en Docker

El flujo por defecto mantiene la API en el host y Docker solo levanta MySQL. Para levantar también la API en un perfil aislado:

```bash
docker compose --profile api up -d
```

El volumen `api_uploads` se monta en `/workspace/api/uploads`, que coincide con `process.cwd()/uploads` en el runtime. Al arrancar se copian solo los defaults ausentes; `mysql_data` conserva su nombre y montaje original.

## Usuarios seed (solo local)

Todos usan `Password123!`.

| Rol | Email |
|-----|-------|
| ADMIN | `admin@gimnasiowapp.local` |
| TEACHER | `teacher@gimnasiowapp.local` |
| CLIENT | `client@example.com` |

## Qué está implementado

- Auth JWT + Bcrypt + validación Zod.
- CRUD de usuarios con foto, rol y mensualidad `PAGADO/IMPAGADO`.
- Restablecimiento de contraseñas de usuarios por administrador desde web y mobile.
- Fecha de vencimiento de cuota para clientes; `ADMIN` y `TEACHER` quedan exentos.
- Avisos al admin cuando un cliente notifica un pago y renovación manual/confirmada por 1 mes.
- CRUD de clases con tipo de clase, profesor, aforo e imagen automática por banco de imágenes.
- Reserva solo para clientes con mensualidad pagada.
- Reserva bloqueada si la cuota del cliente está vencida.
- Clases llenas pasan a `EN_ESPERA`, no se bloquea el botón por aforo.
- Promoción transaccional con `SELECT ... FOR UPDATE` y prioridad para no penalizados.
- Validación de asistencia hasta 30 minutos antes.
- Admin/profesor propietario pueden quitar usuarios de una clase.
- La app móvil incluye detalle de clase adaptado con reservas, lista de espera, asistencia y gestión de alumnos.
- Cron de no-show, penalización, promoción y recordatorios push.
- Registro de `push_token` desde la app Expo al iniciar sesión.

## Tests y verificación

```bash
docker compose up -d
npm -w api run test
npm -w api run build
npm -w web run build
npm -w mobile exec tsc --noEmit
npm -w mobile run export:android
npm -w mobile run export:ios
npm audit --omit=dev
```

El test usa `gimnasio_test`, creado por `database/init/001-create-test-db.sql`.

## Estructura

- `/api`: Node.js + Express + Prisma 6.19.3 + MySQL.
- `/web`: React + Vite + TailwindCSS.
- `/mobile`: Expo + React Native + `expo-notifications`.

La estructura completa está en [`ARCHITECTURE_MAP.md`](./ARCHITECTURE_MAP.md).

## Rutas críticas

Ver documentación completa en [`api/docs/API.md`](./api/docs/API.md).

- `POST /api/auth/login`
- `POST /api/push-devices`
- `GET /api/class-types`
- `PUT /api/class-types/:id` (`ADMIN`, JSON o multipart `image`)
- `GET /api/classes`
- `POST /api/membership/payments`
- `GET /api/membership/payments/pending`
- `POST /api/membership/payments/:id/confirm`
- `POST /api/membership/users/:userId/renew`
- `GET /api/admin-notifications`
- `PUT /api/users/:id/password`
- `POST /api/classes/:classId/reservations`
- `DELETE /api/classes/:classId/reservations/:userId`
- `POST /api/classes/:classId/attendance/validate`

## Seguridad aplicada

- Zod en payloads y params.
- Passwords con Bcrypt (`BCRYPT_COST=12` por defecto).
- JWT con secreto mínimo de 32 caracteres.
- Prisma ORM para queries normales y tagged templates para SQL raw seguro.
- Helmet, CORS y rate limit en Express.
- `npm audit --omit=dev` sin vulnerabilidades.

## Nota de producción importante

El esquema pedido no incluye log persistente para recordatorios push. El cron de recordatorio usa ventana temporal de 45-46 minutos; para idempotencia fuerte ante reinicios conviene agregar una tabla `NotificacionesEnviadas` o un campo `recordatorio_enviado_at`.

Además, `/var/www/gimnasiowapp/current/api/uploads` debe resolver siempre a `/var/www/gimnasiowapp/shared/uploads`. El orden de copia de imágenes por defecto, backup verificado, migración sin seed/reset y comprobaciones pre/post está en [`docs/PRODUCTION_OPERATIONS.md`](./docs/PRODUCTION_OPERATIONS.md).

## Publicación mobile

La app Expo tiene `mobile/app.config.js`, `mobile/eas.json`, iconos y scripts para EAS Build/Submit. Antes de subirla a Apple/Google necesitás una API pública HTTPS y credenciales reales de tienda.

Guía completa: [`docs/STORE_RELEASE.md`](./docs/STORE_RELEASE.md).
