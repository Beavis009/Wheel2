import { readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const html = await readFile("index.html", "utf8");
const match = html.match(/<script type="module" id="wheel-app">\n([\s\S]*?)\n\s*<\/script>/);

if (!match) {
  console.error("Could not find the wheel app module in index.html.");
  process.exit(1);
}

await rm(".tmp", { recursive: true, force: true });
await mkdir(".tmp", { recursive: true });

const extracted = `// @ts-check\n${match[1]}`;
const appPath = resolve(".tmp/index-app.js");
await writeFile(appPath, extracted, "utf8");

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  executable,
  [
    "tsc",
    "--allowJs",
    "--checkJs",
    "--noEmit",
    "--target",
    "ES2022",
    "--skipLibCheck",
    "--lib",
    "DOM,DOM.Iterable,ES2022",
    appPath
  ],
  { stdio: "inherit", shell: process.platform === "win32" }
);

process.exit(result.status || 0);
