import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releaseNotes } from "./release-notes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

assert(packageJson.name === "opencode-vigia", "release package must be opencode-vigia");
assert(packageJson.private !== true, "release package must not be private");
assert(packageJson.type === "module", "release package must remain ESM-only");
assert(packageJson.bin?.vigia === "dist/init.js", "release package must keep the vigia bin");
assert(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(packageJson.version), `invalid version ${packageJson.version}`);
assert(packageJson.version !== "0.0.0", "set a real version before a release: pnpm release <version>");
assert(
  releaseNotes(packageJson.version),
  `CHANGELOG.md must have a non-empty "## [${packageJson.version}]" section`,
);

const refType = process.env.GITHUB_REF_TYPE;
const refName = process.env.GITHUB_REF_NAME;
if (refType === "tag") {
  assert(refName?.startsWith("v"), `release tag must start with v, got ${refName ?? "<unset>"}`);
  assert(
    refName.slice(1) === packageJson.version,
    `release tag ${refName} must match package version ${packageJson.version}`,
  );
}

for (const workflowFile of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
  const content = readFileSync(path.join(root, workflowFile), "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/uses:\s*([^\s#]+)/);
    if (!match || match[1].startsWith("./")) continue;
    const ref = match[1].split("@")[1];
    assert(ref, `${workflowFile} action reference must include a ref: ${line.trim()}`);
    assert(/^[a-f0-9]{40}$/i.test(ref), `${workflowFile} action must be pinned to a full SHA: ${line.trim()}`);
  }
}

const status = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim();
if (process.env.VIGIA_RELEASE_ALLOW_DIRTY !== "1") {
  assert(status === "", `release tree must be clean after verification, found:\n${status}`);
}

console.log(`Release preflight passed for opencode-vigia@${packageJson.version}.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
