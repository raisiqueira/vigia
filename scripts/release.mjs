import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2]?.replace(/^v/, "");

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: pnpm release <version>, for example: pnpm release 0.1.0");
  process.exit(1);
}

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

assert(git("status", "--short") === "", "the working tree must be clean");
assert(git("branch", "--show-current") === "main", "release from the main branch");
assert(git("tag", "--list", `v${version}`) === "", `tag v${version} already exists`);

const changelogPath = path.join(root, "CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf8");
const unreleased = /^## \[Unreleased\]\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(changelog);
assert(unreleased && unreleased[1].trim() !== "", "CHANGELOG.md must have entries under ## [Unreleased]");
const date = new Date().toISOString().slice(0, 10);
writeFileSync(changelogPath, changelog.replace("## [Unreleased]\n", `## [Unreleased]\n\n## [${version}] - ${date}\n`));

const packageJsonPath = path.join(root, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
packageJson.version = version;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

git("add", "CHANGELOG.md", "package.json");
git("commit", "-m", `chore: release v${version}`);
git("tag", "-a", `v${version}`, "-m", `v${version}`);

console.log(`Created the release commit and tag v${version}. Check them, then push:

  git push origin main v${version}

The release workflow publishes to npm and creates the GitHub release.`);

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
