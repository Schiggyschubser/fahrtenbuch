#!/usr/bin/env node

import fs from "node:fs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const expected = fs.readFileSync("VERSION", "utf8").trim();
const packageVersion = readJson("package.json").version;
const lock = readJson("package-lock.json");
const lockVersion = lock.version;
const rootLockVersion = lock.packages?.[""]?.version;
const compose = fs.readFileSync("docker-compose.yaml", "utf8");
const composeVersion = compose.match(/VERSION:\s*\$\{BUILD_VERSION:-(\d+\.\d+\.\d+)\}/)?.[1];
const changelogVersion = readJson("lib/changelog.json")[0]?.version;

const versions = {
  VERSION: expected,
  "package.json": packageVersion,
  "package-lock.json": lockVersion,
  "package-lock root": rootLockVersion,
  "lib/changelog.json": changelogVersion,
};
if (composeVersion) versions["docker-compose.yaml"] = composeVersion;

const invalid = Object.entries(versions).filter(([, value]) => value !== expected);
if (invalid.length > 0) {
  console.error(`Versionsdateien sind nicht konsistent. Erwartet: ${expected}`);
  for (const [name, value] of invalid) console.error(`- ${name}: ${value ?? "nicht gefunden"}`);
  process.exit(1);
}

console.log(`Version ${expected} ist in allen relevanten Dateien konsistent.`);
