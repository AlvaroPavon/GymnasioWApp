# Store Release Checklist

## Android / Google Play

Package: `com.azrael.ronquillotecuida`

Generated artifacts:

- Production AAB:
  - `C:/Users/alvar/Documents/GimnasioWapp/.deploy/ronquillotecuida-production-v1.0.0-vc7-new-upload-key.aab`
- New upload certificate for Google Play reset:
  - `C:/Users/alvar/Documents/GimnasioWapp/mobile/credentials/ronquillotecuida-upload-certificate.pem`
- New private upload keystore:
  - `C:/Users/alvar/Documents/GimnasioWapp/mobile/credentials/ronquillotecuida-upload-key.jks`
- Local signing config:
  - `C:/Users/alvar/Documents/GimnasioWapp/mobile/credentials.json`
- Secret backup file:
  - `C:/Users/alvar/Documents/GimnasioWapp/mobile/credentials/ronquillotecuida-upload-key.secrets.json`

Security rules:

- Upload only the `.pem` certificate to Google for upload-key reset.
- Never upload/share the `.jks`, `credentials.json`, or `.secrets.json`.
- Keep an offline backup of the `.jks` and passwords.

If the old upload key is lost for an existing Play Console app:

1. Open Play Console.
2. Go to the app using package `com.azrael.ronquillotecuida`.
3. Go to app signing / Play App Signing.
4. Start upload-key reset.
5. Attach `ronquillotecuida-upload-certificate.pem`.
6. Wait for Google to approve/apply the reset. Google may apply a delayed validity start date.
7. Upload the generated `.aab`.

## iOS / Apple App Store

Bundle ID: `com.azrael.ronquillotecuida`

Validated locally:

- `npm -w mobile run release:check`
- `npm -w mobile exec tsc --noEmit`
- `npm -w mobile run export:ios`
- `npx expo-doctor@latest mobile`

Status:

- Codebase and Expo config are aligned with Android.
- A real App Store `.ipa` requires an Apple Developer Program account and iOS signing credentials.
- After creating the Apple Developer account, create the App ID/bundle ID in Apple Developer / App Store Connect and run an EAS iOS production build.
