import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const configMarker = "    const DEFAULT_FIREBASE_CONFIG = null;";
const requiredKeys = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];

const html = await readFile("index.html", "utf8");
const rawConfig = (process.env.FIREBASE_WEB_CONFIG || "").trim();
const requireConfig = process.env.REQUIRE_FIREBASE_WEB_CONFIG === "1";

let output = html;

if (rawConfig) {
  let config;

  try {
    config = JSON.parse(rawConfig);
  } catch {
    console.error("FIREBASE_WEB_CONFIG must be valid JSON.");
    process.exit(1);
  }

  const missingKeys = requiredKeys.filter((key) => !config[key]);
  if (missingKeys.length > 0) {
    console.error(`FIREBASE_WEB_CONFIG is missing required keys: ${missingKeys.join(", ")}`);
    process.exit(1);
  }

  const serializedConfig = JSON.stringify(config, null, 6)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `    ${line}`))
    .join("\n");

  output = html.replace(
    configMarker,
    `    const DEFAULT_FIREBASE_CONFIG = Object.freeze(${serializedConfig});`
  );
}

if (requireConfig && !rawConfig) {
  console.error("FIREBASE_WEB_CONFIG GitHub secret is required for Pages deployment.");
  process.exit(1);
}

if (output === html && rawConfig) {
  console.error("Could not find Firebase config marker in index.html.");
  process.exit(1);
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", output, "utf8");
