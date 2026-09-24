const SESSION_KEYS = {
  token: "token",
  user: "user",
  rememberLogin: "rememberLogin"
};

const PUBLIC_USER_FIELDS = [
  "id",
  "name",
  "email",
  "role",
  "monthlyStatus",
  "estado_mensualidad",
  "membershipExpiresAt",
  "membership_expires_at",
  "phone",
  "profilePicture",
  "profile_picture",
  "classReminderEnabled",
  "class_reminder_enabled",
  "createdAt",
  "created_at"
];

const AUTHORITATIVE_REALTIME_SCOPES = new Set([
  "users",
  "membership",
  "global"
]);

export function toSafeSessionUser(user) {
  if (!user || typeof user !== "object" || user.id == null || !user.role) {
    throw new TypeError("The authenticated user payload is invalid.");
  }

  return PUBLIC_USER_FIELDS.reduce((safeUser, field) => {
    if (user[field] !== undefined) safeUser[field] = user[field];
    return safeUser;
  }, {});
}

export function shouldRefreshAuthoritativeUser(message) {
  return message?.type === "DATA_CHANGED"
    && AUTHORITATIVE_REALTIME_SCOPES.has(message.scope);
}

export function setSessionAuthorization(httpClient, token) {
  if (!httpClient?.defaults?.headers?.common) return;

  if (token) {
    httpClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete httpClient.defaults.headers.common.Authorization;
  }
}

export async function clearSessionState({
  storage,
  httpClient,
  preserveRememberPreference = false
}) {
  setSessionAuthorization(httpClient, null);
  const keys = preserveRememberPreference
    ? [SESSION_KEYS.token, SESSION_KEYS.user]
    : Object.values(SESSION_KEYS);
  await storage.multiRemove(keys);
}

export async function reconcileAuthoritativeSession({
  storage,
  httpClient,
  apiBaseUrl,
  token,
  rememberMe
}) {
  if (!token) {
    await clearSessionState({ storage, httpClient });
    return { status: "signed-out", reason: "missing-token" };
  }

  setSessionAuthorization(httpClient, token);

  let response;
  try {
    response = await httpClient.get(`${apiBaseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    if (error?.response?.status !== 401) throw error;

    await clearSessionState({ storage, httpClient });
    return { status: "signed-out", reason: "unauthorized" };
  }

  const user = toSafeSessionUser(response.data);
  const entries = [[SESSION_KEYS.user, JSON.stringify(user)]];

  if (typeof rememberMe === "boolean") {
    entries.push(
      [SESSION_KEYS.token, token],
      [SESSION_KEYS.rememberLogin, rememberMe ? "true" : "false"]
    );
  }

  await storage.multiSet(entries);
  return { status: "authenticated", user };
}

export { SESSION_KEYS };
