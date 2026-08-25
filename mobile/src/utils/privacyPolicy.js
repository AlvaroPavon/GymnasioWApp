import { Alert, Linking } from "react-native";

export const PRIVACY_POLICY_URL =
  "https://ronquillotecuida.duckdns.org/privacy-policy.html";

export const openPrivacyPolicy = async () => {
  try {
    await Linking.openURL(PRIVACY_POLICY_URL);
  } catch {
    Alert.alert("Error", "No se pudo abrir la pol\u00edtica de privacidad.");
  }
};
