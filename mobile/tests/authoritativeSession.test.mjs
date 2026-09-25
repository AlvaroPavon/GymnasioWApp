import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  clearSessionState,
  reconcileAuthoritativeSession,
  shouldRefreshAuthoritativeUser
} from "../src/auth/session.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));

  return {
    values,
    async multiRemove(keys) {
      keys.forEach((key) => values.delete(key));
    },
    async multiSet(entries) {
      entries.forEach(([key, value]) => values.set(key, value));
    }
  };
}

function createHttpClient(get) {
  return {
    defaults: { headers: { common: {} } },
    get
  };
}

test("the active dashboard role reset does not call the removed menu state", async () => {
  const source = await readFile(new URL("../src/screens/DashboardScreen.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /setMenuOpen\s*\(/);
});

test("replaces a cached role with the authoritative current role", async () => {
  const storage = createStorage({
    token: "access-token",
    user: JSON.stringify({ id: 7, role: "CLIENT" }),
    rememberLogin: "true"
  });
  const httpClient = createHttpClient(async (requestUrl, options) => {
    assert.equal(requestUrl, "https://api.example.test/api/auth/me");
    assert.equal(options.headers.Authorization, "Bearer access-token");
    return { data: { id: 7, name: "Ada", email: "ada@example.test", role: "ADMIN" } };
  });

  const result = await reconcileAuthoritativeSession({
    storage,
    httpClient,
    apiBaseUrl: "https://api.example.test/api",
    token: "access-token"
  });

  assert.equal(result.status, "authenticated");
  assert.equal(result.user.role, "ADMIN");
  assert.equal(JSON.parse(storage.values.get("user")).role, "ADMIN");
});

test("clears the session and authorization after a deleted user returns 401", async () => {
  const storage = createStorage({
    token: "deleted-user-token",
    user: JSON.stringify({ id: 8, role: "CLIENT" }),
    rememberLogin: "true"
  });
  const httpClient = createHttpClient(async () => {
    const error = new Error("Unauthorized");
    error.response = { status: 401 };
    throw error;
  });

  const result = await reconcileAuthoritativeSession({
    storage,
    httpClient,
    apiBaseUrl: "https://api.example.test/api",
    token: "deleted-user-token"
  });

  assert.deepEqual(result, { status: "signed-out", reason: "unauthorized" });
  assert.equal(storage.values.has("token"), false);
  assert.equal(storage.values.has("user"), false);
  assert.equal(storage.values.has("rememberLogin"), false);
  assert.equal("Authorization" in httpClient.defaults.headers.common, false);
});

test("replaces stale profile and membership data without persisting secrets", async () => {
  const storage = createStorage({
    token: "access-token",
    user: JSON.stringify({
      id: 9,
      role: "CLIENT",
      profilePicture: "https://old.example.test/photo.jpg",
      monthlyStatus: "IMPAGADO"
    })
  });
  const httpClient = createHttpClient(async () => ({
    data: {
      id: 9,
      name: "Grace",
      email: "grace@example.test",
      role: "CLIENT",
      profilePicture: "https://new.example.test/photo.jpg",
      monthlyStatus: "PAGADO",
      membershipExpiresAt: "2026-09-30T23:59:59.000Z",
      classReminderEnabled: true,
      password: "must-not-be-cached",
      passwordHash: "must-not-be-cached",
      accessToken: "must-not-be-cached"
    }
  }));

  const result = await reconcileAuthoritativeSession({
    storage,
    httpClient,
    apiBaseUrl: "https://api.example.test/api",
    token: "access-token"
  });
  const cachedUser = JSON.parse(storage.values.get("user"));

  assert.equal(result.user.profilePicture, "https://new.example.test/photo.jpg");
  assert.equal(cachedUser.monthlyStatus, "PAGADO");
  assert.equal(cachedUser.membershipExpiresAt, "2026-09-30T23:59:59.000Z");
  assert.equal(cachedUser.classReminderEnabled, true);
  assert.equal("password" in cachedUser, false);
  assert.equal("passwordHash" in cachedUser, false);
  assert.equal("accessToken" in cachedUser, false);
});

test("refreshes identity only for user, membership, and global realtime changes", () => {
  for (const scope of ["users", "membership", "global"]) {
    assert.equal(shouldRefreshAuthoritativeUser({ type: "DATA_CHANGED", scope }), true);
  }

  assert.equal(shouldRefreshAuthoritativeUser({ type: "DATA_CHANGED", scope: "classes" }), false);
  assert.equal(shouldRefreshAuthoritativeUser({ type: "CONNECTED" }), false);
});

test("keeps remember-me disabled while retaining the active in-app session", async () => {
  const storage = createStorage();
  const httpClient = createHttpClient(async () => ({
    data: { id: 10, name: "Lin", email: "lin@example.test", role: "TEACHER" }
  }));

  await reconcileAuthoritativeSession({
    storage,
    httpClient,
    apiBaseUrl: "https://api.example.test/api",
    token: "temporary-session-token",
    rememberMe: false
  });

  assert.equal(storage.values.get("token"), "temporary-session-token");
  assert.equal(storage.values.get("rememberLogin"), "false");
  assert.equal(JSON.parse(storage.values.get("user")).role, "TEACHER");

  await clearSessionState({
    storage,
    httpClient,
    preserveRememberPreference: true
  });

  assert.equal(storage.values.has("token"), false);
  assert.equal(storage.values.has("user"), false);
  assert.equal(storage.values.get("rememberLogin"), "false");
});
