import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "../api/client";

export async function registerPushToken(accessToken: string) {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await apiFetch("/push-devices", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ pushToken: token, platform: Platform.OS === "ios" ? "IOS" : "ANDROID" })
  });

  return token;
}
