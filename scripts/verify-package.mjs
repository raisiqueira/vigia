import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const requiredFiles = [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/dist/init.js",
  "package/agents/vigia.md",
  "package/agents/vigia/hunter.md",
  "package/agents/vigia/verifier.md",
  "package/skills/vigia-method/SKILL.md",
  "package/examples/opencode.jsonc",
];
const forbiddenPrefixes = ["package/src/", "package/tests/", "package/evals/", "package/docs/", "package/.vigia/"];

if (!existsSync(path.join(root, "dist", "index.js"))) {
  console.error("dist/index.js is missing. Run `pnpm build` first.");
  process.exit(1);
}

const work = mkdtempSync(path.join(tmpdir(), "vigia-package-"));

try {
  execFileSync("pnpm", ["pack", "--pack-destination", work], { cwd: root, shell: isWindows, stdio: "pipe" });
  const tarballs = readdirSync(work).filter((file) => file.endsWith(".tgz"));
  assert(tarballs.length === 1, `expected one tarball, found ${tarballs.length}`);
  const tarball = path.join(work, tarballs[0]);

  const files = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).trim().split("\n");
  for (const file of requiredFiles) assert(files.includes(file), `missing ${file} from tarball`);
  for (const file of files) {
    assert(!forbiddenPrefixes.some((prefix) => file.startsWith(prefix)), `tarball must not contain ${file}`);
    assert(!file.endsWith(".ts") || file.endsWith(".d.ts"), `tarball must not contain TypeScript source ${file}`);
  }

  execFileSync("tar", ["-xzf", tarball, "-C", work, "package/dist/init.js"]);
  const init = readFileSync(path.join(work, "package/dist/init.js"), "utf8");
  assert(init.startsWith("#!/usr/bin/env node"), "dist/init.js must start with a node shebang");

  const consumer = path.join(work, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies: { "opencode-vigia": `file:${tarball}` } }),
  );
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], {
    cwd: consumer,
    shell: isWindows,
    stdio: "pipe",
  });

  runPluginSetup(consumer);
  runInit(consumer);

  console.log(`Package verification passed for ${tarballs[0]} (${files.length} files).`);
} finally {
  rmSync(work, { force: true, recursive: true });
}

/** Calls setup() with a fake OpenCode context and checks what the plugin registers. */
function runPluginSetup(consumer) {
  const project = path.join(work, "project");
  mkdirSync(project);
  const result = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `const plugin = (await import("opencode-vigia")).default;
if (plugin.id !== "vigia" || typeof plugin.setup !== "function") throw new Error("bad plugin definition");
const tools = [], skills = [], hooks = [];
const editor = (into) => ({ add: (item) => into.push(item), namespace() {} });
await plugin.setup({
  location: { directory: ${JSON.stringify(project)} },
  skill: { transform: async (edit) => edit(editor(skills)) },
  tool: { transform: async (edit) => edit(editor(tools)), hook: async (name) => hooks.push("tool." + name) },
  permission: { hook: async (name) => hooks.push("permission." + name) },
});
const expected = ["url", "html", "finding_save", "finding_list", "report"];
const names = tools.map((tool) => tool.name);
if (expected.some((name) => !names.includes(name))) throw new Error("missing tools: " + names.join(", "));
if (skills.length !== 1 || !skills[0].content.includes("# Vigia method")) throw new Error("vigia-method skill did not load");
if (!hooks.includes("permission.evaluate") || !hooks.includes("tool.execute.before")) throw new Error("missing hooks: " + hooks.join(", "));
const parsed = JSON.parse((await tools.find((tool) => tool.name === "url").execute({ input: "da\\tta:x", base: "https://app.test/" })).content);
if (parsed.whatwg.protocol !== "data:") throw new Error("url oracle failed");`,
    ],
    { cwd: consumer, encoding: "utf8" },
  );
  assert(result.status === 0, result.stderr || "plugin setup failed");
}

function runInit(consumer) {
  const project = path.join(work, "init-project");
  mkdirSync(project);
  const bin = path.join(consumer, "node_modules", ".bin", isWindows ? "vigia.cmd" : "vigia");
  execFileSync(bin, ["init"], { cwd: project, shell: isWindows, stdio: "pipe" });
  for (const agent of ["vigia.md", "vigia/hunter.md", "vigia/verifier.md"]) {
    assert(existsSync(path.join(project, ".opencode", "agents", agent)), `vigia init did not create ${agent}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
