import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Returns the body of the `## [version]` section of the changelog, or undefined. */
export function releaseNotes(version, changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8")) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) return undefined;
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const body = lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
  return body === "" ? undefined : body;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  const notes = version && releaseNotes(version);
  if (!notes) {
    console.error(`CHANGELOG.md has no notes for ${version ?? "<missing version>"}.`);
    process.exit(1);
  }
  console.log(notes);
}
