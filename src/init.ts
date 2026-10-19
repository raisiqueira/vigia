#!/usr/bin/env node
import { cp, readdir, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

const AGENTS_SOURCE = fileURLToPath(new URL("../agents/", import.meta.url))

const USAGE = `Usage: vigia init [--global] [--force]

Copies the Vigia agents into .opencode/agents/ of the current project.
  --global  Copy into ~/.config/opencode/agents/ instead.
  --force   Replace agent files that already exist.`

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true })
  const files = await Promise.all(
    entries.map(async (entry) => ((await stat(join(directory, entry))).isFile() ? entry : undefined)),
  )
  return files.filter((file): file is string => file !== undefined)
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}

async function init(options: { global: boolean; force: boolean }) {
  const target = options.global
    ? join(homedir(), ".config", "opencode", "agents")
    : join(process.cwd(), ".opencode", "agents")

  for (const file of await listFiles(AGENTS_SOURCE)) {
    const destination = join(target, file)
    const shown = relative(process.cwd(), destination) || destination
    if (!options.force && (await exists(destination))) {
      console.log(`skip     ${shown} (exists, use --force to replace)`)
      continue
    }
    await cp(join(AGENTS_SOURCE, file), destination, { recursive: true })
    console.log(`created  ${shown}`)
  }

  console.log(`
Next steps:
  1. Add the plugin to opencode.jsonc:  "plugins": ["opencode-vigia"]
  2. Start a scan:                       opencode --agent vigia`)
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    global: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
})

if (values.help || positionals[0] !== "init") {
  console.log(USAGE)
  process.exit(values.help ? 0 : 1)
}

await init({ global: values.global, force: values.force })
