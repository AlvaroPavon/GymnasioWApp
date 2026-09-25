const appName = process.env.APP_NAME ?? "Ronquillo Te Cuida";
const appSlug = process.env.APP_SLUG ?? "ronquillotecuida";
const appScheme = process.env.APP_SCHEME ?? "ronquillotecuida";
const appVersion = process.env.APP_VERSION ?? "1.0.2";
const iosBundleIdentifier =
  process.env.IOS_BUNDLE_IDENTIFIER ?? "com.azrael.ronquillotecuida";
const androidPackage = process.env.ANDROID_PACKAGE ?? "com.azrael.ronquillotecuida";

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
    ios: {
      supportsTablet: false,
      bundleIdentifier: iosBundleIdentifier,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: androidPackage,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#09090b"
      },
      permissions: ["POST_NOTIFICATIONS"]
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          backgroundColor: "#09090b",
          image: "./assets/splash-transparent.png",
          imageWidth: 1
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#f4a621",
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
