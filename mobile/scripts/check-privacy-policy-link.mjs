import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const mobileDirectory = path.resolve(scriptsDirectory, "..");

const expectedUrl =
  "https://ronquillotecuida.duckdns.org/privacy-policy.html";

const sourceFiles = {
  helper: ["src", "utils", "privacyPolicy.js"],
  LoginScreen: ["screens", "LoginScreen.js"],
  DashboardScreen: ["src", "screens", "DashboardScreen.js"]
};

const displayPath = (segments) => segments.join("/");

export async function collectPrivacyPolicyFailures(rootDirectory = mobileDirectory) {
  const failures = [];
  const sources = {};

  await Promise.all(
    Object.entries(sourceFiles).map(async ([name, segments]) => {
      try {
        sources[name] = await readFile(path.join(rootDirectory, ...segments), "utf8");
      } catch {
        failures.push(`Missing required privacy-policy source: ${displayPath(segments)}.`);
      }
    })
  );

  if (sources.helper && !sources.helper.includes(expectedUrl)) {
    failures.push("The shared privacy-policy helper does not contain the production URL.");
  }

  for (const screen of ["LoginScreen", "DashboardScreen"]) {
    const source = sources[screen];
    if (!source) continue;

    if (!source.includes("import { openPrivacyPolicy }")) {
      failures.push(`${screen} does not import the shared openPrivacyPolicy helper.`);
    }

    if (!source.includes("onPress={openPrivacyPolicy}")) {
      failures.push(`${screen} does not connect the privacy link to the shared helper.`);
    }

    if (source.includes("PRIVACY_POLICY_URL")) {
      failures.push(`${screen} declares or references a screen-local privacy URL.`);
    }
  }

  return failures;
}

const isEntryPoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  const failures = await collectPrivacyPolicyFailures();

  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Privacy-policy links use the shared safe opener.");
  }
}
