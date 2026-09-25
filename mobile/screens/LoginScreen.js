import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
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
import { ArrowRight, EnvelopeSimple, Eye, EyeSlash, LockKey } from "phosphor-react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getApiBaseUrl } from "../src/api/config";
import {
  clearSessionState,
  reconcileAuthoritativeSession,
  setSessionAuthorization
} from "../src/auth/session";
import { classReminderEnabled } from "../src/utils/activityCalendar";
import { openPrivacyPolicy } from "../src/utils/privacyPolicy";
import { COLORS, RADII } from "../src/theme";

const brandLogo = require("../assets/logo.jpg");
const COPYRIGHT_TEXT = "Creada por Álvaro Pavón. Derechos reservados.";

const getApiErrorMessage = (error, fallback) => {
  const apiMessage = error?.response?.data?.error?.message || error?.response?.data?.message;
  if (apiMessage) return apiMessage;
  if (error?.code === "ECONNABORTED") return "La solicitud tardó demasiado. Inténtalo de nuevo.";
  if (error?.isAxiosError || error?.code === "ERR_NETWORK") return "No se pudo conectar con el servidor. Revisa tu conexión.";
  return fallback;
};

const normalizeEmail = (value) => value.trim().toLowerCase();

export default function LoginScreen({ navigation }) {
  const passwordInputRef = useRef(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

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
            await clearSessionState({
              storage: AsyncStorage,
              httpClient: axios,
              preserveRememberPreference: true
            });
          }
          return;
        }

        const token = await AsyncStorage.getItem("token");
        if (!active) return;

        if (!token) {
          await clearSessionState({
            storage: AsyncStorage,
            httpClient: axios,
            preserveRememberPreference: true
          });
          return;
        }

        const session = await reconcileAuthoritativeSession({
          storage: AsyncStorage,
          httpClient: axios,
          apiBaseUrl: getApiBaseUrl(),
          token
        });
        if (active && session.status === "authenticated") {
          if (classReminderEnabled(session.user)) {
            await registerPushToken(token);
          }
          navigation.replace("Dashboard");
        }
      } catch (error) {
        setSessionAuthorization(axios, null);
        if (active) {
          Alert.alert(
            "No se pudo comprobar la sesión",
            getApiErrorMessage(error, "Comprueba tu conexión e inténtalo de nuevo.")
          );
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    };

    restoreSession();

    return () => {
      active = false;
    };
  }, [navigation]);

  useEffect(() => {
    if (checkingSession) return undefined;
    if (reduceMotion) {
      entrance.stopAnimation();
      entrance.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [checkingSession, entrance, reduceMotion]);

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
    } catch {
      console.log("Push registration skipped.");
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
      const session = await reconcileAuthoritativeSession({
        storage: AsyncStorage,
        httpClient: axios,
        apiBaseUrl: getApiBaseUrl(),
        token,
        rememberMe
      });
      if (session.status !== "authenticated") {
        throw new Error("SESSION_VALIDATION_FAILED");
      }
      if (classReminderEnabled(session.user)) {
        await registerPushToken(token);
      }
      navigation.replace("Dashboard");
    } catch (error) {
      setSessionAuthorization(axios, null);
      Alert.alert("Error", getApiErrorMessage(error, "Credenciales inválidas"));
    } finally {
      setLoginLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Comprobando sesión...</Text>
      </SafeAreaView>
    );
  }

  const KeyboardContainer = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const keyboardCompact = keyboardVisible || inputFocused;
  const cardTranslateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

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
          <Animated.View style={[styles.card, keyboardCompact && styles.cardKeyboard, { opacity: entrance, transform: [{ translateY: cardTranslateY }] }]}>
            <View style={[styles.logoFrame, keyboardCompact && styles.logoFrameKeyboard]}>
              <Image source={brandLogo} style={[styles.logo, keyboardCompact && styles.logoKeyboard]} resizeMode="contain" />
            </View>
            <Text style={styles.eyebrow}>ACCESO SEGURO</Text>
            <Text style={[styles.title, keyboardCompact && styles.titleKeyboard]}>Bienvenido de nuevo</Text>
            <Text style={[styles.subtitle, keyboardCompact && styles.subtitleKeyboard]}>Gestiona tus clases y reservas</Text>

            <Text style={styles.inputLabel}>EMAIL</Text>
            <View style={[styles.inputShell, keyboardCompact && styles.inputShellKeyboard]}>
              <EnvelopeSimple size={20} color={COLORS.accent} weight="bold" />
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor={COLORS.textMuted}
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
            </View>

            <Text style={styles.inputLabel}>CONTRASEÑA</Text>
            <View style={[styles.inputShell, keyboardCompact && styles.inputShellKeyboard]}>
              <LockKey size={20} color={COLORS.accent} weight="bold" />
              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder="Tu contraseña"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!passwordVisible}
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
              <TouchableOpacity
                accessibilityLabel={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setPasswordVisible((visible) => !visible)}
                style={styles.visibilityButton}
              >
                {passwordVisible
                  ? <EyeSlash size={20} color={COLORS.textSecondary} weight="bold" />
                  : <Eye size={20} color={COLORS.textSecondary} weight="bold" />}
              </TouchableOpacity>
            </View>

            <View style={[styles.rememberRow, keyboardCompact && styles.rememberRowKeyboard]}>
              <Text style={styles.rememberText}>Recordarme en este dispositivo</Text>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: COLORS.elevated, true: COLORS.accent }}
                thumbColor={rememberMe ? "#fff7e6" : COLORS.textSecondary}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, keyboardCompact && styles.buttonKeyboard, loginLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loginLoading}
              activeOpacity={0.86}
            >
              <Text style={styles.buttonText}>{loginLoading ? "Entrando..." : "Ingresar"}</Text>
              {!loginLoading ? <ArrowRight size={20} color="#19120a" weight="bold" /> : null}
            </TouchableOpacity>
            <Text style={[styles.copyrightText, keyboardCompact && styles.copyrightTextKeyboard]}>
              {COPYRIGHT_TEXT}
            </Text>
            <TouchableOpacity onPress={openPrivacyPolicy} activeOpacity={0.82}>
              <Text style={[styles.privacyLinkText, keyboardCompact && styles.privacyLinkTextKeyboard]}>
                {"Pol\u00edtica de privacidad"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center" },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 18
  },
  scrollContentKeyboard: {
    justifyContent: "flex-start",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12
  },
  card: {
    backgroundColor: "rgba(24,24,27,0.97)",
    padding: 22,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10
  },
  cardKeyboard: { padding: 14, borderRadius: RADII.large },
  logoFrame: { width: "100%", height: 126, borderRadius: RADII.large, marginBottom: 19, backgroundColor: "#fff", padding: 7, overflow: "hidden" },
  logoFrameKeyboard: { height: 70, marginBottom: 9, borderRadius: RADII.medium },
  logo: {
    width: "100%",
    height: "100%",
    borderRadius: RADII.medium,
    backgroundColor: "#ffffff"
  },
  logoKeyboard: { borderRadius: RADII.small },
  eyebrow: { color: COLORS.accent, fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 1.8, marginBottom: 4 },
  title: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 4,
    letterSpacing: -0.9
  },
  titleKeyboard: { fontSize: 22, lineHeight: 26, marginBottom: 1 },
  subtitle: { color: COLORS.textSecondary, marginBottom: 24, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  subtitleKeyboard: { marginBottom: 10, fontSize: 12 },
  inputLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 6 },
  inputShell: {
    minHeight: 54,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADII.medium,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  inputShellKeyboard: { minHeight: 46, marginBottom: 9 },
  input: { flex: 1, minWidth: 0, color: COLORS.text, paddingVertical: 12, fontSize: 15, fontWeight: "700" },
  visibilityButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  loadingText: { color: COLORS.textSecondary, marginTop: 14, fontWeight: "800", textAlign: "center" },
  rememberRow: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.medium,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  rememberRowKeyboard: { paddingVertical: 8, marginBottom: 4 },
  rememberText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "800", flex: 1, paddingRight: 12 },
  button: {
    minHeight: 54,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    borderRadius: RADII.medium,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 6
  },
  buttonKeyboard: { minHeight: 48, marginTop: 6 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: {
    color: "#19120a",
    fontWeight: "900",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  copyrightText: {
    color: COLORS.textMuted,
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
    color: COLORS.textSecondary,
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
