# Publicación en Apple App Store y Google Play

Esta guía describe el flujo local de preparación. No reemplaza la revisión final de App Store Connect o Play Console y no ejecuta builds ni envíos por sí sola.

## Base móvil verificada

- Expo SDK `57.0.16`.
- React Native `0.86.2` con React `19.2.3`.
- Node.js `>=20.19`.
- Configuración dinámica: `mobile/app.config.js`.
- Perfiles remotos: `mobile/eas.json`.
- Validación local: `mobile/scripts/validate-release-env.mjs`.
- Cargador local de entorno: `mobile/src/release/runWithEnv.mjs`.

## Bloqueantes antes de enviar a revisión

1. `EXPO_PUBLIC_API_URL` debe ser una API pública HTTPS; no se admiten hosts locales ni dominios de ejemplo.
2. Los identificadores de iOS y Android deben coincidir con los registrados en las tiendas.
3. La política de privacidad canónica debe responder públicamente en:
   `https://ronquillotecuida.duckdns.org/privacy-policy.html`.
4. La misma URL debe figurar en Play Console, App Store Connect y dentro de la app.
5. Se necesitan cuentas Apple Developer, Google Play Developer y Expo/EAS válidas.
6. APNs y FCM V1 deben estar configurados para las notificaciones push.
7. Las capturas deben provenir de dispositivos reales o emuladores con datos de prueba limpios.

## Preparar el entorno local sin exponer secretos

Desde `C:\Users\alvar\Documents\GimnasioWapp\mobile`:

```powershell
Copy-Item .env.production.example .env.production
```

Completá `mobile/.env.production` localmente. El archivo está ignorado por Git; no pegues sus valores en documentación, tickets, logs ni comandos de CI.

Variables esperadas:

```dotenv
EXPO_PUBLIC_API_URL=https://api.example.invalid
APP_NAME=...
APP_SLUG=...
APP_SCHEME=...
APP_VERSION=...
IOS_BUNDLE_IDENTIFIER=...
ANDROID_PACKAGE=...
IOS_BUILD_NUMBER=...
ANDROID_VERSION_CODE=...
```

`EXPO_PUBLIC_API_URL` termina embebida en el cliente y por tanto **no es un secreto**. Credenciales de tienda, service accounts, claves APNs/FCM y keystores sí lo son: deben permanecer en EAS Credentials/Secrets o en el gestor seguro del equipo, nunca en `.env.production` ni en el repo.

## Validaciones con entorno cargado de verdad

Los scripts `npm run release:check*` leen `process.env`; npm no carga `.env.production` automáticamente. Usá el cargador versionado para cargar el archivo **antes** de iniciar el validador:

```powershell
cd C:\Users\alvar\Documents\GimnasioWapp\mobile

# Solo Android
node src/release/runWithEnv.mjs release:check:android

# Android + iOS
node src/release/runWithEnv.mjs release:check
```

Para probar una plantilla sin copiarla:

```powershell
node src/release/runWithEnv.mjs release:check:android --release-env-file=.env.production.example
```

El cargador no imprime valores. Las variables ya definidas en la terminal tienen prioridad sobre el archivo; usá una sesión limpia para evitar valores heredados.

## Android — Google Play

Configuración vigente:

- Nombre: `Ronquillo Te Cuida`.
- Package: `com.azrael.ronquillotecuida`.
- API pública: `https://ronquillotecuida.duckdns.org`.
- Listing: `mobile/store/android-listing.md`.
- Política: `https://ronquillotecuida.duckdns.org/privacy-policy.html`.

Preparación de credenciales:

```powershell
npx eas-cli@22.3.0 login
npx eas-cli@22.3.0 whoami
npx eas-cli@22.3.0 credentials
```

Cuando corresponda generar el AAB, ejecutá el build mediante el cargador para que el `release:check:android` heredado reciba el entorno:

```powershell
node src/release/runWithEnv.mjs build:android
```

El primer AAB debe cargarse y revisarse en Play Console según el estado de la cuenta. Probá primero en el track interno antes de promover una versión.

Después de validar el artefacto y configurar el perfil de envío:

```powershell
node src/release/runWithEnv.mjs submit:android
```

## iOS — Apple App Store

1. Registrar el Bundle ID en Apple Developer.
2. Crear la app en App Store Connect con el mismo `IOS_BUNDLE_IDENTIFIER`.
3. Configurar credenciales con `npx eas-cli@22.3.0 credentials`.
4. Generar el build mediante el cargador:

```powershell
node src/release/runWithEnv.mjs build:ios
```

5. Tras verificar TestFlight y la metadata, enviar con:

```powershell
node src/release/runWithEnv.mjs submit:ios
```

## Privacidad y Data safety

Google Play exige que la política sea accesible dentro de la app y desde el campo correspondiente de Play Console. La ruta acordada es `/privacy-policy.html`; no usar `/privacy`, redirecciones ambiguas ni documentos locales.

Datos funcionales que maneja la app:

- Nombre, email, teléfono y rol.
- Estado de cuota y fecha de vencimiento.
- Reservas, lista de espera, asistencia y penalizaciones.
- Reportes administrativos de pago.
- Foto de perfil cuando se carga.
- Token push de Expo para avisos operativos.

Declaración base, pendiente de contrastar con el formulario final de cada tienda:

- Sin tracking publicitario.
- Datos vinculados al usuario para funcionalidad y administración del gimnasio.
- Notificaciones push para recordatorios y cambios de reserva.
- Sin venta de datos.

La política pública y el formulario Data safety deben describir exactamente el comportamiento de la versión enviada. Si se habilita alta de cuentas para el usuario final, el flujo de eliminación de cuenta y datos pasa a ser bloqueante antes de publicar.

## Verificación técnica previa

Desde la raíz del repo, sin generar artefactos de tienda:

```powershell
npm -w mobile test
npm -w mobile run typecheck
```

Validaciones completas del monorepo, cuando el alcance del release las permita:

```powershell
npm -w api run test
npm -w api run build
npm -w web run build
```

Los exports, builds y submits son pasos separados y deliberados. No deben ejecutarse como parte de una revisión de UI o documentación.

## Fuentes oficiales

- Node.js `--env-file`: https://nodejs.org/api/cli.html#--env-filefile
- Expo EAS Build: https://docs.expo.dev/build/
- Expo EAS Submit: https://docs.expo.dev/deploy/submit-to-app-stores/
- Expo push notifications con FCM: https://docs.expo.dev/push-notifications/using-fcm/
- Apple App Privacy: https://developer.apple.com/app-store/app-privacy-details/
- Google Play User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play App content: https://support.google.com/googleplay/android-developer/answer/9859455
