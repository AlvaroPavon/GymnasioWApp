const appName = process.env.APP_NAME ?? "Ronquillo Te Cuida";
const appSlug = process.env.APP_SLUG ?? "ronquillotecuida";
const appScheme = process.env.APP_SCHEME ?? "ronquillotecuida";
const appVersion = process.env.APP_VERSION ?? "1.0.1";
const iosBundleIdentifier =
  process.env.IOS_BUNDLE_IDENTIFIER ?? "com.azrael.ronquillotecuida";
const androidPackage = process.env.ANDROID_PACKAGE ?? "com.azrael.ronquillotecuida";
const iosBuildNumber = process.env.IOS_BUILD_NUMBER ?? "1";
const androidVersionCode = Number.parseInt(
  process.env.ANDROID_VERSION_CODE ?? "1",
  10
);

module.exports = {
  expo: {
    name: appName,
    slug: appSlug,
    version: appVersion,
    orientation: "portrait",
    scheme: appScheme,
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: iosBundleIdentifier,
      buildNumber: iosBuildNumber,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: androidPackage,
      versionCode: Number.isFinite(androidVersionCode) ? androidVersionCode : 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: ["POST_NOTIFICATIONS"]
    },
    plugins: [
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#2563eb",
          defaultChannel: "default"
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Permite seleccionar una imagen de la biblioteca para los tipos de clase.",
          cameraPermission: false,
          microphonePermission: false
        }
      ]
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
      eas: {
        projectId: "b63f0033-0b33-4ec3-b730-541ab1826d2e"
      }
    }
  }
};
