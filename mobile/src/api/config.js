import { Platform } from "react-native";

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const getDevelopmentApiOrigin = () =>
  Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";

export function getApiOrigin() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fallbackUrl = typeof __DEV__ !== "undefined" && __DEV__ ? getDevelopmentApiOrigin() : "";
  return trimTrailingSlash(configuredUrl || fallbackUrl);
}

export function getApiBaseUrl() {
  const origin = getApiOrigin();
  if (!origin) {
    throw new Error("EXPO_PUBLIC_API_URL is required for production mobile builds.");
  }
  return `${origin}/api`;
}
