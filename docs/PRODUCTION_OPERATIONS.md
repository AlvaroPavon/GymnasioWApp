# Operación segura de producción

Un release solo puede activarse cuando conserva los uploads compartidos y la migración supera todas las comprobaciones de integridad. En producción se ejecuta `prisma migrate deploy`; **nunca** `prisma migrate reset`, un reset forzado ni el seed.

## Invariante de uploads

| Recurso | Ruta obligatoria |
|---------|------------------|
| Release activo | `/var/www/gimnasiowapp/current` |
| Uploads persistentes | `/var/www/gimnasiowapp/shared/uploads` |
| Enlace consumido por la API | `/var/www/gimnasiowapp/current/api/uploads` → `/var/www/gimnasiowapp/shared/uploads` |
| Imágenes de tipos de clase | `/var/www/gimnasiowapp/shared/uploads/class-types` |

La API resuelve uploads desde `process.cwd()/uploads`. Por eso, cuando el proceso arranca en `current/api`, esa ruta **debe ser el enlace anterior**; un directorio dentro del release perdería archivos en el siguiente despliegue.

### Orden obligatorio antes de cambiar `current`

1. Descomprimir el nuevo release sin tocar `current` ni `shared/uploads`.
2. Crear `shared/uploads/class-types` si no existe.
3. Copiar únicamente los defaults ausentes desde `<new-release>/api/uploads/class-types`:

   ```bash
   install -d -m 0755 /var/www/gimnasiowapp/shared/uploads/class-types
   cp -n <new-release>/api/uploads/class-types/* \
     /var/www/gimnasiowapp/shared/uploads/class-types/
   ```

4. Hacer que `<new-release>/api/uploads` apunte a `/var/www/gimnasiowapp/shared/uploads`.
5. Verificar el destino real del enlace y la lectura de los tres defaults:

   ```bash
   test "$(readlink -f <new-release>/api/uploads)" = "/var/www/gimnasiowapp/shared/uploads"
   test -r <new-release>/api/uploads/class-types/entrenamiento-funcional.jpg
   test -r <new-release>/api/uploads/class-types/pilates.jpg
   test -r <new-release>/api/uploads/class-types/yoga.jpg
   ```

6. Solo entonces cambiar atómicamente el enlace `current` al nuevo release y volver a verificar:

   ```bash
   test "$(readlink -f /var/www/gimnasiowapp/current/api/uploads)" = \
     "/var/www/gimnasiowapp/shared/uploads"
   ```

`cp -n` es deliberado: un deploy incorpora defaults que falten, pero nunca sobrescribe una imagen persistente existente.

## Migración de producción sin pérdida de datos

### Puertas de seguridad

- Bloquear escrituras o abrir una ventana de mantenimiento antes de tomar evidencias.
- Usar una copia de seguridad nueva, con checksum, restaurada y comprobada en una base aislada.
- Guardar conteos pre/post de **cada tabla** y la identidad/fingerprint de las dos cuentas `ADMIN` existentes.
- Ejecutar solo migraciones versionadas con `npm -w api run prisma:migrate:deploy`.
- No ejecutar `prisma migrate reset`, `prisma db push --force-reset` ni `npm -w api run prisma:seed`.
- Si un conteo, relación o cuenta admin no coincide con lo esperado, abortar antes de activar el release.

### 1. Capturar el estado previo

Con las escrituras detenidas, guardar estas evidencias fuera del directorio del release:

```sql
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

SELECT id, email,
       SHA2(CONCAT_WS('|', id, nombre, email, password_hash, rol,
         estado_mensualidad,
         COALESCE(DATE_FORMAT(membership_expires_at, '%Y-%m-%dT%H:%i:%s.%f'), '<NULL>'),
         COALESCE(telefono, '<NULL>'), COALESCE(profile_picture, '<NULL>')), 256) AS fingerprint
FROM Usuarios
WHERE rol = 'ADMIN'
ORDER BY id;
```

Para cada nombre devuelto por la primera consulta, registrar `SELECT COUNT(*) FROM \`<tabla>\`;`. La segunda consulta debe devolver exactamente las dos cuentas admin actuales; conservar `id`, `email` y `fingerprint` para la comparación posterior.

### 2. Crear y verificar el backup

Usar credenciales desde un archivo protegido, no desde el historial del shell:

```bash
umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
partial="gimnasiowapp-${stamp}.sql.partial"
final="gimnasiowapp-${stamp}.sql.gz"
mysqldump --defaults-extra-file=/root/.my.cnf \
  --single-transaction --quick --skip-lock-tables \
  --no-tablespaces --set-gtid-purged=OFF --hex-blob --triggers \
  gimnasiowapp > "$partial"
test -s "$partial"
gzip -9 -c "$partial" > "${final}.partial"
gzip -t "${final}.partial"
mv "${final}.partial" "$final"
rm -f "$partial"
sha256sum "$final" > "${final}.sha256"
sha256sum -c "${final}.sha256"
```

`--no-tablespaces` evita exigir el privilegio global `PROCESS`. Antes del
volcado hay que confirmar que todas las tablas son InnoDB y comprobar si
existen rutinas o eventos; sus flags solo se añaden cuando existen y el usuario
de backup dispone de los privilegios correspondientes. Un archivo `.partial`
procedente de un comando fallido se marca como `.FAILED` y nunca se considera
restaurable.

Restaurar ese dump en una base aislada, ejecutar `mysqlcheck` sobre la restauración y repetir allí los conteos y fingerprints. El backup no se considera verificado hasta que la restauración coincide con las evidencias previas.

### 3. Ejecutar la migración

Desde el release nuevo, con `DATABASE_URL` apuntando explícitamente a producción:

```bash
npm -w api run prisma:migrate:deploy
```

No ejecutar el seed después. El seed crea o actualiza usuarios y datos de demostración; no forma parte de una migración de producción.

### 4. Validar antes de activar el release

Repetir los conteos de todas las tablas y la consulta de admins. Se acepta únicamente:

- Las dos cuentas admin conservan los mismos `id`, `email` y `fingerprint`.
- Todas las tablas conservan su conteo salvo cambios explicados por migraciones pendientes.
- `_prisma_migrations` aumenta exactamente por la cantidad de migraciones aplicadas.
- Para `0004_class_type_images`, `Clases` y `Penalizaciones` no cambian de conteo. `TiposClase` solo puede variar por la normalización `Functional`/`Entrenamiento funcional` y por insertar defaults ausentes (`Entrenamiento funcional`, `Yoga`, `Pilates`).
- Para `0006_class_enrollment_preferences`, `Usuarios` y `Reservas` no cambian de conteo: solo se añaden columnas con defaults seguros y un índice de recordatorios.
- No existen relaciones huérfanas:

  ```sql
  SELECT COUNT(*) AS orphan_classes
  FROM Clases c LEFT JOIN TiposClase t ON t.id = c.tipo_clase_id
  WHERE t.id IS NULL;

  SELECT COUNT(*) AS orphan_penalties
  FROM Penalizaciones p LEFT JOIN TiposClase t ON t.id = p.tipo_clase_id
  WHERE t.id IS NULL;
  ```

Ambos conteos de huérfanos deben ser `0`. Ante cualquier diferencia no explicada: **no cambiar `current`, no arrancar la nueva API y no improvisar un reset**. Conservar evidencias, investigar y restaurar el backup verificado si corresponde.

## Contrato de imágenes de tipos de clase

### `PUT /api/class-types/:id`

Endpoint exclusivo de `ADMIN`. Acepta:

- `multipart/form-data` con el archivo `image` y, opcionalmente, `name` o `nombre`.
- JSON con `imageUrl` o `image_url` para configurar una URL HTTP(S) externa.

La imagen multipart puede ser JPEG, PNG o WebP, con máximo de 4 MiB, 8192 px por lado y 25 millones de píxeles. La API la decodifica, elimina metadatos, la normaliza a WebP y guarda una URL `/uploads/class-types/<uuid>.webp`. La respuesta expone los alias `imageUrl` e `image_url` como URL absoluta.

### Imagen efectiva frente a override

En las respuestas de clases, la precedencia visible es:

1. Override de la clase.
2. Imagen de su tipo de clase.
3. Banco de imágenes legado.

| Campos | Significado |
|--------|-------------|
| `imageUrl`, `image_url`, `effectiveImageUrl`, `effective_image_url` | Imagen efectiva que debe mostrarse. |
| `imageOverrideUrl`, `image_override_url` | Override almacenado en la clase; puede ser `null` aunque exista imagen efectiva. |
| `classType.imageUrl`, `classType.image_url` | Imagen heredable del tipo de clase. |

Al editar una clase, usar `imageOverrideUrl`/`image_override_url` para crear, cambiar o limpiar el override. No persistir la imagen efectiva heredada como si fuera un override.
