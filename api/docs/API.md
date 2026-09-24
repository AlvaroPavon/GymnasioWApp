# GimnasioWapp API

Base URL local: `http://localhost:3000`.

Todas las rutas privadas requieren:

```http
Authorization: Bearer <jwt>
```

Los errores siguen este formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request payload", "details": {} } }
```

## Auth

### POST `/api/auth/login`

```json
{
  "email": "admin@gimnasiowapp.local",
  "password": "Password123!"
}
```

**200**

```json
{
  "user": { "id": 1, "name": "Admin", "email": "admin@gimnasiowapp.local", "role": "ADMIN" },
  "accessToken": "jwt",
  "token": "jwt"
}
```

### POST `/api/auth/register`

Crea un cliente con mensualidad `IMPAGADO` por defecto.

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "Password123!"
}
```

## Usuarios

### GET `/api/users`

Requiere `ADMIN`.

### POST `/api/users`

Requiere `ADMIN`. Acepta JSON o `multipart/form-data` con `profile`.

```json
{
  "name": "Client Test",
  "email": "client@example.com",
  "password": "Password123!",
  "role": "CLIENT",
  "estado_mensualidad": "PAGADO",
  "membership_expires_at": "2026-06-30T21:59:59.000Z",
  "phone": "+34 600 000 000"
}
```

### PUT `/api/users/:id`

Requiere `ADMIN`. Permite actualizar `name`, `email`, `role`, `estado_mensualidad`, `membership_expires_at`, `phone` y `profile`.

`ADMIN` y `TEACHER` no pagan cuota: el backend fuerza `PAGADO` y `membership_expires_at = null`.

### PUT `/api/users/:id/password`

Requiere `ADMIN`. Restablece la contraseña de un usuario cuando la olvida.

```json
{ "password": "NewPassword123!" }
```

**200**

```json
{ "id": 3, "name": "Client Test", "email": "client@example.com", "role": "CLIENT" }
```

### GET `/api/users/eligible-clients`

Requiere `ADMIN` o `TEACHER`. Devuelve clientes con cuota pagada y no vencida que pueden asignarse como fijos al crear una serie de clases.

### PATCH `/api/users/me/preferences`

Actualiza la preferencia de recordatorio del usuario autenticado.

```json
{ "classReminderEnabled": true }
```

## Membresías y pagos

### POST `/api/membership/payments`

Requiere `CLIENT`. El cliente notifica que pagó; el admin recibe un aviso para confirmarlo.

```json
{
  "amountCents": 4500,
  "notes": "Transferencia bancaria"
}
```

### GET `/api/membership/payments/pending`

Requiere `ADMIN`. Lista pagos pendientes.

### POST `/api/membership/payments/:id/confirm`

Requiere `ADMIN`. Confirma el pago y renueva desde la fecha más lejana entre `now` y el vencimiento actual.

```json
{ "months": 1 }
```

### POST `/api/membership/users/:userId/renew`

Requiere `ADMIN`. Renovación manual sin reporte previo del cliente.

```json
{ "months": 1 }
```

### GET `/api/admin-notifications`

Requiere `ADMIN`. Lista avisos de pagos reportados y cuotas vencidas.

## Push devices

### POST `/api/push-devices`

```json
{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "IOS"
}
```

**201**

```json
{ "device": { "id": 1, "userId": 1, "pushToken": "ExponentPushToken[...]", "platform": "IOS" } }
```

## Tipos de clase

### GET `/api/class-types`

Devuelve tipos disponibles para crear/editar clases.

### POST `/api/class-types`

Requiere `ADMIN`.

```json
{ "name": "Spinning" }
```

### PUT `/api/class-types/:id`

Requiere `ADMIN`. Acepta JSON para renombrar o asignar una URL, y `multipart/form-data`
con el campo `image` para subir una imagen jpeg, png o webp. Las subidas se validan,
se convierten a WebP sin metadatos y se guardan bajo `/uploads/class-types/`.

```json
{ "name": "Pilates", "image_url": "https://cdn.example.test/pilates.webp" }
```

`image_url: null` (o cadena vacía) elimina la asignación. Al reemplazar o limpiar una
imagen, la API solo borra archivos WebP generados por ella que estén huérfanos dentro
de `uploads/class-types`; nunca borra defaults empaquetados ni archivos todavía
referenciados por tipos, clases, `ImageBank`, perfiles o settings.

## Clases

### GET `/api/classes`

Devuelve clases visibles para el usuario autenticado. Para profesores, solo sus clases.

- `_count.reservations` cuenta solo ocupación real: `CONFIRMADA` + `ASISTENCIA_VALIDADA`.
- `reservations[]` incluye `CONFIRMADA`, `ASISTENCIA_VALIDADA`, `EN_ESPERA` y `NO_ASISTE` para pintar estados en UI.
- Para `CLIENT`, `reservations[]` contiene su propia reserva y asistentes con plaza (`CONFIRMADA`/`ASISTENCIA_VALIDADA`). Los demás asistentes se serializan como perfiles públicos sin email, teléfono, cuota ni pagos; si eligieron ocultarse, se devuelve un asistente anónimo y `userId: null`.
- Para `CLIENT`, `teacher` es un resumen público con `id`, `name`, `role`, `profilePicture` y `profile_picture`. No expone email, teléfono, contraseña, membresía ni pagos. `ADMIN` y `TEACHER` reciben el DTO completo que necesitan para gestionar clases.
- `image_url`/`imageUrl` es siempre la imagen efectiva: override de la clase, imagen del tipo asignado, mejor coincidencia por título con otro tipo que tenga imagen y, por último, `ImageBank`.
- La coincidencia por título normaliza mayúsculas, acentos y separadores, exige palabras/frases completas y prefiere coincidencias exactas o más largas. `Functional` y `Entrenamiento funcional` son alias; `General` nunca se usa como coincidencia amplia.
- `image_override_url`/`imageOverrideUrl` contiene solo el override explícito o `null`; la resolución no reasigna el tipo ni modifica IDs.

### POST `/api/classes`

Requiere `ADMIN` o `TEACHER`. Si crea un profesor, `teacherId` se fuerza al usuario autenticado.

```json
{
  "title": "Yoga",
  "description": "Morning yoga",
  "classTypeId": 1,
  "teacherId": 2,
  "maxCapacity": 20,
  "startsAt": "2026-06-01T09:00:00.000Z",
  "endsAt": "2026-06-01T10:00:00.000Z",
  "repeatWeeks": 4,
  "fixedUserIds": [3, 7]
}
```

`repeatWeeks` acepta de 1 a 52 y crea las clases separadas por siete días dentro de una sola transacción. `fixedUserIds` se deduplica, no puede superar el aforo y solo acepta clientes pagados/no vencidos; cada uno queda `CONFIRMADA` con `fixedEnrollment: true` en toda la serie. Un profesor solo puede asignarse a sí mismo.

También acepta alias de la UI: `tipo_clase_id`, `teacher_id`, `max_capacity`, `start_time`, `end_time`, `image_url`.

Semántica de `image_override_url` (también `imageOverrideUrl`):

- Omitido: en creación no establece override; en actualización conserva el valor actual.
- URL válida: establece o reemplaza la imagen específica de esa clase.
- `null` (o cadena vacía): elimina el override y vuelve a la imagen del tipo de clase o al fallback.

`image_url`/`imageUrl` se mantiene como alias compatible de entrada, pero para escrituras nuevas se recomienda `image_override_url` porque distingue explícitamente entre conservar, establecer y eliminar.

### PUT `/api/classes/:id`

Requiere `ADMIN` o profesor propietario.

### DELETE `/api/classes/:id`

Requiere `ADMIN`.

## Reservas

### POST `/api/classes/:classId/reservations`

Requiere cliente con `estado_mensualidad = PAGADO` y `membership_expires_at` futuro.

Puede incluir la opción de privacidad:

```json
{ "hideName": true }
```

**201 confirmado**

```json
{
  "reservation": { "id": 1, "userId": 3, "classId": 10, "status": "CONFIRMADA" },
  "status": "CONFIRMADA"
}
```

**201 lista de espera**

```json
{
  "reservation": { "id": 2, "userId": 4, "classId": 10, "status": "EN_ESPERA" },
  "status": "EN_ESPERA"
}
```

Errores relevantes:

```json
{ "error": { "code": "MEMBERSHIP_REQUIRED", "message": "Active membership payment is required before reserving" } }
```

```json
{ "error": { "code": "RESERVATION_ALREADY_EXISTS", "message": "User already has an active reservation for this class" } }
```

### POST `/api/classes/:id/reserve`

Alias de compatibilidad para la UI web/mobile. Mismo comportamiento que `POST /api/classes/:classId/reservations`.

### POST `/api/classes/:id/cancel`

Cliente cancela su propia reserva. Si libera cupo, promociona lista de espera.

### PATCH `/api/classes/:classId/reservations/privacy`

Requiere `CLIENT` y una reserva activa propia. Cambia únicamente si su nombre será visible para otros clientes; admin y profesor siguen viendo la identidad real.

```json
{ "hideName": true }
```

### DELETE `/api/classes/:classId/reservations/:userId`

Admin puede quitar a cualquiera. Profesor solo en su propia clase. Cliente solo su propia reserva.

**200**

```json
{
  "cancelled": { "id": 1, "status": "CANCELADA" },
  "promoted": [{ "userId": 4, "classId": 10, "classTitle": "Yoga" }]
}
```

### POST `/api/classes/:classId/attendance/validate`

Cliente valida asistencia hasta 30 minutos antes. Si tenía penalización activa para el tipo de clase, queda desactivada.

**200**

```json
{ "reservation": { "id": 1, "status": "ASISTENCIA_VALIDADA" } }
```

## Settings e imágenes

### GET `/api/settings`

Público. Devuelve `app_name` y `hero_image` para marca blanca.

### PUT `/api/settings`

Requiere `ADMIN`. Acepta `multipart/form-data` con `hero`.

### GET/POST/DELETE `/api/image-bank`

Requiere `ADMIN`. Mapea `keyword` a `image_url` para asignar imágenes automáticamente a clases.

## Recordatorios de clase

- El usuario activa/desactiva el recordatorio mediante `PATCH /api/users/me/preferences`.
- El cron busca reservas `CONFIRMADA` o `ASISTENCIA_VALIDADA` cuya clase empieza entre 60 y 61 minutos después.
- `recordatorio_enviado_en` se reclama atómicamente antes del push para impedir duplicados entre procesos o reinicios.
- Si Expo Push falla, el claim se libera para permitir el reintento.

## Seguridad

- No expongas `JWT_SECRET`, `.env` ni dumps de DB.
- Las queries raw usan tagged templates de Prisma; no concatenar inputs del usuario en SQL.
