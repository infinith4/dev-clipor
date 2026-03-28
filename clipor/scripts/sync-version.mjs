import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rawVersion = process.argv[2];

if (!rawVersion) {
  console.error("Usage: node scripts/sync-version.mjs <version-or-tag>");
  process.exit(1);
}

const version = rawVersion.startsWith("v") ? rawVersion.slice(1) : rawVersion;

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version: ${rawVersion}`);
  process.exit(1);
}

const root = process.cwd();

const updateVersionWithRegex = (relativePath, pattern) => {
  const filePath = resolve(root, relativePath);
  const source = readFileSync(filePath, "utf8");
  const updated = source.replace(pattern, `$1${version}$3`);

  if (updated === source) {
    return;
  }

  writeFileSync(filePath, updated);
};

const updateCargoTomlVersion = (relativePath) => {
  const filePath = resolve(root, relativePath);
  const source = readFileSync(filePath, "utf8");
  const pattern = /(\[package\][\s\S]*?^version = ")([^"]+)(")/m;
  const match = source.match(pattern);

  if (!match) {
    console.error(`Failed to locate version in ${relativePath}`);
    process.exit(1);
  }

  const updated = source.replace(
    pattern,
    `$1${version}$3`,
  );

  if (updated === source) {
    return;
  }

  writeFileSync(filePath, updated);
};

updateVersionWithRegex("package.json", /("version":\s*")([^"]+)(")/);
updateVersionWithRegex("src-tauri/tauri.conf.json", /("version":\s*")([^"]+)(")/);
updateCargoTomlVersion("src-tauri/Cargo.toml");

console.log(`Synchronized app version to ${version}`);
