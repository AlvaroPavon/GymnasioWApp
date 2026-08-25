import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectPrivacyPolicyFailures } from "../scripts/check-privacy-policy-link.mjs";

const expectedUrl =
  "https://ronquillotecuida.duckdns.org/privacy-policy.html";
const validScreen = `
import { openPrivacyPolicy } from "../utils/privacyPolicy";
const link = <TouchableOpacity onPress={openPrivacyPolicy} />;
`;

async function createFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "privacy-link-check-"));
  t.after(() => rm(root, { force: true, recursive: true }));

  await Promise.all([
    mkdir(path.join(root, "src", "utils"), { recursive: true }),
    mkdir(path.join(root, "src", "screens"), { recursive: true }),
    mkdir(path.join(root, "screens"), { recursive: true })
  ]);
  await Promise.all([
    writeFile(
      path.join(root, "src", "utils", "privacyPolicy.js"),
      `export const privacyPolicyUrl = "${expectedUrl}";`
    ),
    writeFile(path.join(root, "screens", "LoginScreen.js"), validScreen),
    writeFile(path.join(root, "src", "screens", "DashboardScreen.js"), validScreen)
  ]);

  return root;
}

test("validates the active login and dashboard privacy links", async (t) => {
  const root = await createFixture(t);

  assert.deepEqual(await collectPrivacyPolicyFailures(root), []);
});

test("fails when the active dashboard is removed even if a legacy dashboard remains", async (t) => {
  const root = await createFixture(t);
  await writeFile(path.join(root, "screens", "DashboardScreen.js"), validScreen);
  await unlink(path.join(root, "src", "screens", "DashboardScreen.js"));

  const failures = await collectPrivacyPolicyFailures(root);

  assert.ok(
    failures.includes(
      "Missing required privacy-policy source: src/screens/DashboardScreen.js."
    )
  );
});

test("keeps validating the active login screen", async (t) => {
  const root = await createFixture(t);
  await writeFile(
    path.join(root, "screens", "LoginScreen.js"),
    "const link = <TouchableOpacity />;"
  );

  const failures = await collectPrivacyPolicyFailures(root);

  assert.ok(
    failures.includes(
      "LoginScreen does not import the shared openPrivacyPolicy helper."
    )
  );
  assert.ok(
    failures.includes(
      "LoginScreen does not connect the privacy link to the shared helper."
    )
  );
});
