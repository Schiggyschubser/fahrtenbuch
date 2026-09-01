#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  }).trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertVersion(value, label = "Version") {
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`${label} muss dem Format MAJOR.MINOR.PATCH entsprechen: ${value}`);
  }
}

function calculateVersion(currentVersion, requestedBump) {
  assertVersion(currentVersion, "Aktuelle Version");
  const [major, minor, patch] = currentVersion.split(".").map(Number);
  const bump = requestedBump.trim().toLowerCase();

  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;

  throw new Error(`Unbekannter Versionssprung: ${requestedBump}`);
}

const root = runGit(["rev-parse", "--show-toplevel"]);
process.chdir(root);

const versionPath = path.join(root, "VERSION");
const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");
const composePath = path.join(root, "docker-compose.yaml");
const changelogPath = path.join(root, "lib", "changelog.json");

const generatedFiles = new Set([
  "VERSION",
  "package.json",
  "package-lock.json",
  "docker-compose.yaml",
  "lib/changelog.json",
]);

const commitMessage = runGit(["log", "-1", "--format=%s"]);
if (!commitMessage || commitMessage.includes("[skip version]")) process.exit(0);

const requestedBump = (process.env.VERSION_BUMP || "patch").trim();
if (["none", "skip", "off"].includes(requestedBump.toLowerCase())) process.exit(0);

const changedFiles = runGit(["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "HEAD"])
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => !generatedFiles.has(file));

// Ein Commit, der ausschließlich automatisch erzeugte Versionsdateien enthält,
// darf nicht noch einmal eine Version erzeugen.
if (changedFiles.length === 0) process.exit(0);

const committedDiff = runGit(["show", "--format=", "--binary", "HEAD", "--", ...changedFiles]);
const fingerprint = createHash("sha256")
  .update(`${commitMessage}\0${changedFiles.join("\0")}\0${committedDiff}`)
  .digest("hex")
  .slice(0, 16);

const changelog = readJson(changelogPath);
if (changelog.some((entry) => entry.fingerprint === fingerprint)) {
  console.log("Dieser Commit ist bereits im Changelog erfasst.");
  process.exit(0);
}

const currentVersion = fs.readFileSync(versionPath, "utf8").trim();
const nextVersion = calculateVersion(currentVersion, requestedBump);
if (nextVersion === currentVersion) {
  throw new Error("Die neue Version muss sich von der aktuellen Version unterscheiden.");
}

const packageJson = readJson(packagePath);
const packageLock = readJson(lockPath);
packageJson.version = nextVersion;
packageLock.version = nextVersion;
if (packageLock.packages?.[""]) packageLock.packages[""].version = nextVersion;

let compose = fs.readFileSync(composePath, "utf8");
const versionPattern = /(VERSION:\s*\$\{BUILD_VERSION:-)(\d+\.\d+\.\d+)(\})/;
const composeHasVersion = versionPattern.test(compose);
if (composeHasVersion) {
  compose = compose.replace(versionPattern, `$1${nextVersion}$3`);
}

changelog.unshift({
  version: nextVersion,
  date: new Date().toISOString().slice(0, 10),
  title: commitMessage,
  fileCount: changedFiles.length,
  files: changedFiles,
  fingerprint,
});

fs.writeFileSync(versionPath, `${nextVersion}\n`);
writeJson(packagePath, packageJson);
writeJson(lockPath, packageLock);
if (composeHasVersion) fs.writeFileSync(composePath, compose);
writeJson(changelogPath, changelog);

runGit(["add", "--", ...generatedFiles]);
execFileSync("git", ["commit", "--amend", "--no-edit", "--no-verify"], {
  stdio: "inherit",
  env: { ...process.env, VERSION_HOOK_RUNNING: "1" },
});
console.log(`Version automatisch von ${currentVersion} auf ${nextVersion} erhöht.`);
