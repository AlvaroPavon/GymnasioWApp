const required = {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  ANDROID_PACKAGE: process.env.ANDROID_PACKAGE
};

const platform = process.argv[2] ?? process.env.RELEASE_PLATFORM ?? "all";
if (platform !== "android") {
  required.IOS_BUNDLE_IDENTIFIER = process.env.IOS_BUNDLE_IDENTIFIER;
}

const missing = Object.entries(required)
  .filter(([, value]) => !value?.trim())
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing required release environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

let apiUrl;
try {
  apiUrl = new URL(required.EXPO_PUBLIC_API_URL);
} catch {
  console.error("EXPO_PUBLIC_API_URL must be a valid absolute URL.");
  process.exit(1);
}
const blockedHosts = new Set(["localhost", "127.0.0.1", "10.0.2.2", "0.0.0.0"]);

if (apiUrl.protocol !== "https:") {
  console.error("EXPO_PUBLIC_API_URL must use HTTPS for App Store and Play Store builds.");
  process.exit(1);
}

if (blockedHosts.has(apiUrl.hostname) || apiUrl.hostname.endsWith(".example.com")) {
  console.error("EXPO_PUBLIC_API_URL must point to the real production API, not localhost or example.com.");
  process.exit(1);
}

const bundlePattern = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*){2,}$/;
if (required.IOS_BUNDLE_IDENTIFIER && !bundlePattern.test(required.IOS_BUNDLE_IDENTIFIER)) {
  console.error("IOS_BUNDLE_IDENTIFIER must look like com.company.app.");
  process.exit(1);
}

if (!bundlePattern.test(required.ANDROID_PACKAGE)) {
  console.error("ANDROID_PACKAGE must look like com.company.app.");
  process.exit(1);
}

console.log("Mobile release environment looks valid.");
