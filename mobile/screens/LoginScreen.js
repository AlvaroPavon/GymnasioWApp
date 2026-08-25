import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getApiBaseUrl } from "../src/api/config";
import { openPrivacyPolicy } from "../src/utils/privacyPolicy";

const brandLogo = require("../assets/logo.jpg");
const COPYRIGHT_TEXT = "Creada por Álvaro Pavón. Derechos reservados.";

const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const normalizeEmail = (value) => value.trim().toLowerCase();

export default function LoginScreen({ navigation }) {
  const passwordInputRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setInputFocused(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const remember = await AsyncStorage.getItem("rememberLogin");
        setRememberMe(remember !== "false");

        if (remember !== "true") {
          if (remember === "false") {
            await AsyncStorage.multiRemove(["token", "user"]);
          }
          return;
        }

        const [token, rawUser] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("user")
        ]);

        if (!active || !token || !rawUser) return;

        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        navigation.replace("Dashboard");
      } catch {
        await AsyncStorage.multiRemove(["token", "user", "rememberLogin"]);
      } finally {
        if (active) setCheckingSession(false);
      }
    };

    restoreSession();

    return () => {
      active = false;
    };
  }, [navigation]);

  const registerPushToken = async (accessToken) => {
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX
        });
      }

      const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
      await axios.post(
        `${getApiBaseUrl()}/push-devices`,
        {
          pushToken,
          platform: Platform.OS === "ios" ? "IOS" : "ANDROID"
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch (error) {
      console.log("Push registration skipped", error?.message);
    }
  };

  const handleLogin = async () => {
    if (loginLoading) return;

    try {
      setLoginLoading(true);
      const response = await axios.post(`${getApiBaseUrl()}/auth/login`, {
        email: normalizeEmail(email),
        password
      });
      const token = response.data.accessToken || response.data.token;
      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("user", JSON.stringify(response.data.user));
      await AsyncStorage.setItem("rememberLogin", rememberMe ? "true" : "false");
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      await registerPushToken(token);
      navigation.replace("Dashboard");
    } catch (error) {
      Alert.alert("Error", getApiErrorMessage(error, "Credenciales inválidas"));
    } finally {
      setLoginLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.loadingText}>Comprobando sesión...</Text>
      </SafeAreaView>
    );
  }

  const KeyboardContainer = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const keyboardCompact = keyboardVisible || inputFocused;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
      <KeyboardContainer
        {...(Platform.OS === "ios" ? { behavior: "padding" } : {})}
        style={styles.keyboard}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardCompact && styles.scrollContentKeyboard
          ]}
        >
          <View style={[styles.card, keyboardCompact && styles.cardKeyboard]}>
            <Image source={brandLogo} style={[styles.logo, keyboardCompact && styles.logoKeyboard]} resizeMode="contain" />
            <Text style={[styles.title, keyboardCompact && styles.titleKeyboard]}>Ronquillo Te Cuida</Text>
            <Text style={[styles.subtitle, keyboardCompact && styles.subtitleKeyboard]}>Acceso móvil</Text>

            <TextInput
              style={[styles.input, keyboardCompact && styles.inputKeyboard]}
              placeholder="Email"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
            <TextInput
              ref={passwordInputRef}
              style={[styles.input, keyboardCompact && styles.inputKeyboard]}
              placeholder="Contraseña"
              placeholderTextColor="#64748b"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onSubmitEditing={handleLogin}
            />

            <View style={[styles.rememberRow, keyboardCompact && styles.rememberRowKeyboard]}>
              <Text style={styles.rememberText}>Recordarme en este dispositivo</Text>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: "#334155", true: "#2563eb" }}
                thumbColor={rememberMe ? "#bfdbfe" : "#94a3b8"}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, keyboardCompact && styles.buttonKeyboard, loginLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loginLoading}
              activeOpacity={0.86}
            >
              <Text style={styles.buttonText}>{loginLoading ? "Entrando..." : "Ingresar"}</Text>
            </TouchableOpacity>
            <Text style={[styles.copyrightText, keyboardCompact && styles.copyrightTextKeyboard]}>
              {COPYRIGHT_TEXT}
            </Text>
            <TouchableOpacity onPress={openPrivacyPolicy} activeOpacity={0.82}>
              <Text style={[styles.privacyLinkText, keyboardCompact && styles.privacyLinkTextKeyboard]}>
                {"Pol\u00edtica de privacidad"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", justifyContent: "center" },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 18
  },
  scrollContentKeyboard: {
    justifyContent: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12
  },
  card: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  cardKeyboard: {
    padding: 14,
    borderRadius: 20
  },
  logo: {
    width: "100%",
    height: 132,
    borderRadius: 18,
    marginBottom: 20,
    backgroundColor: "#ffffff"
  },
  logoKeyboard: {
    height: 64,
    marginBottom: 8,
    borderRadius: 14
  },
  title: {
    fontSize: 31,
    fontWeight: "900",
    color: "#60a5fa",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -1
  },
  titleKeyboard: {
    fontSize: 22,
    marginBottom: 2
  },
  subtitle: { color: "#94a3b8", textAlign: "center", marginBottom: 32, fontSize: 16 },
  subtitleKeyboard: { marginBottom: 12, fontSize: 13 },
  input: {
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#334155"
  },
  inputKeyboard: {
    padding: 12,
    marginBottom: 10,
    fontSize: 15
  },
  loadingText: { color: "#94a3b8", marginTop: 14, fontWeight: "800", textAlign: "center" },
  rememberRow: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  rememberRowKeyboard: { paddingVertical: 8, marginBottom: 4 },
  rememberText: { color: "#e2e8f0", fontWeight: "800", flex: 1, paddingRight: 12 },
  button: {
    backgroundColor: "#2563eb",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5
  },
  buttonKeyboard: { padding: 14, marginTop: 8 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  copyrightText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center"
  },
  copyrightTextKeyboard: {
    fontSize: 10,
    marginTop: 10
  },
  privacyLinkText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
    textDecorationLine: "underline"
  },
  privacyLinkTextKeyboard: {
    fontSize: 10,
    marginTop: 4
  }
});
