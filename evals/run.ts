import { execFileSync, execSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { FindingStore } from "../dist/findings/store.js"
import type { Finding } from "../dist/findings/finding.js"

interface ExpectedFinding {
  id: string
  files: string[]
  keywords: string[]
}

interface EvalCase {
  name: string
  source: string
  commit: string
  scope: string
  install?: string
  model: string
  expected: ExpectedFinding[]
}

const VIGIA_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PROVEN = new Set(["reproduced", "confirmed"])

const OPENROUTER_PINS: Record<string, unknown> = {
  "z-ai/glm-5.3": {
    limit: { output: 65536 },
    body: { provider: { order: ["z-ai"], allow_fallbacks: false } },
  },
}

function loadCase(path: string): EvalCase & { workDirectory: string } {
  const evalCase = JSON.parse(readFileSync(path, "utf8")) as EvalCase
  return { ...evalCase, workDirectory: join(dirname(resolve(path)), "work") }
}

function git(cwd: string, ...args: string[]) {
  execFileSync("git", ["-c", "user.name=vigia-eval", "-c", "user.email=eval@vigia.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    stdio: "ignore",
  })
}

/** Copies one commit without history, so the agents cannot read later fix commits. */
function prepare(path: string, force: boolean) {
  const evalCase = loadCase(path)
  const work = evalCase.workDirectory
  if (existsSync(work)) {
    if (!force) throw new Error(`${work} exists. Use --force to replace it.`)
    rmSync(work, { recursive: true, force: true })
  }
  mkdirSync(work, { recursive: true })

  execSync(`git -C ${JSON.stringify(evalCase.source)} archive --format=tar ${evalCase.commit} | tar -x -C ${JSON.stringify(work)}`)
  const gitignore = join(work, ".gitignore")
  writeFileSync(gitignore, `${existsSync(gitignore) ? readFileSync(gitignore, "utf8") : ""}\n.vigia/\n`)
  git(work, "init", "-q")
  git(work, "add", "-A")
  git(work, "commit", "-qm", `${evalCase.name} at ${evalCase.commit}`)

  const [providerID, ...modelParts] = evalCase.model.split("/")
  const config = {
    $schema: "https://opencode.ai/config.json",
    plugins: [VIGIA_ROOT],
    model: evalCase.model,
    providers: providerID === "openrouter" ? { openrouter: { models: OPENROUTER_PINS } } : {},
  }
  if (providerID === "openrouter" && !(modelParts.join("/") in OPENROUTER_PINS)) {
    console.warn(`No host pin for ${evalCase.model}. OpenRouter may route requests to any host.`)
  }
  writeFileSync(join(work, "opencode.jsonc"), `${JSON.stringify(config, null, 2)}\n`)
  execFileSync("node", [join(VIGIA_ROOT, "dist", "init.js"), "init"], { cwd: work, stdio: "ignore" })

  if (evalCase.install) execSync(evalCase.install, { cwd: work, stdio: "inherit" })

  console.log(`Prepared ${work}

Run the scan:
  cd ${JSON.stringify(work)} && opencode run --agent vigia --auto "Scan ${evalCase.scope}"

Then score it:
  node evals/run.ts score ${path}`)
}

function matchScore(finding: Finding, expected: ExpectedFinding): number {
  const touchesFile = finding.anchors.some((anchor) => expected.files.some((file) => anchor.file.endsWith(file)))
  if (!touchesFile) return 0
  const text = `${finding.title}\n${finding.description}`.toLowerCase()
  return expected.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length
}

/** Assigns each expected bug to its best matching finding. One finding matches at most one bug. */
function assign(findings: Finding[], expected: ExpectedFinding[]) {
  const candidates = expected
    .flatMap((bug) => findings.map((finding) => ({ bug, finding, score: matchScore(finding, bug) })))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => Number(PROVEN.has(b.finding.status)) - Number(PROVEN.has(a.finding.status)) || b.score - a.score)
  const matches = new Map<string, Finding>()
  const used = new Set<string>()
  for (const { bug, finding } of candidates) {
    if (matches.has(bug.id) || used.has(finding.id)) continue
    matches.set(bug.id, finding)
    used.add(finding.id)
  }
  return { matches, used }
}

async function score(path: string) {
  const evalCase = loadCase(path)
  const { findings, unreadable } = await new FindingStore(evalCase.workDirectory).list()
  const { matches, used } = assign(findings, evalCase.expected)

  console.log(`# ${evalCase.name} at ${evalCase.commit}\n`)
  console.log("| Expected | Finding | Status | Priority |\n| --- | --- | --- | --- |")
  for (const bug of evalCase.expected) {
    const finding = matches.get(bug.id)
    console.log(`| ${bug.id} | ${finding ? `${finding.id}: ${finding.title.slice(0, 60)}` : "missed"} | ${finding?.status ?? "-"} | ${finding?.priority ?? "-"} |`)
  }

  const proven = [...matches.values()].filter((finding) => PROVEN.has(finding.status)).length
  const otherProven = findings.filter((finding) => PROVEN.has(finding.status) && !used.has(finding.id))
  console.log(`
Recall: ${proven}/${evalCase.expected.length} expected bugs proven.
Findings: ${findings.length} total, ${findings.filter((f) => PROVEN.has(f.status)).length} proven, ${findings.filter((f) => f.status === "hypothesis").length} open, ${findings.filter((f) => f.status === "rejected").length} rejected.`)
  if (otherProven.length > 0) {
    console.log("\nOther proven findings. Review each one: it is a new bug or a false positive.")
    for (const finding of otherProven) console.log(`- ${finding.id} (${finding.priority ?? "-"}): ${finding.title}`)
  }
  if (unreadable.length > 0) console.log(`\nUnreadable finding files: ${unreadable.join(", ")}`)
}

const [command, casePath, ...flags] = process.argv.slice(2)
if (!casePath || (command !== "prepare" && command !== "score")) {
  console.log("Usage: node evals/run.ts prepare <case.json> [--force]\n       node evals/run.ts score <case.json>")
  process.exit(1)
}
if (command === "prepare") prepare(casePath, flags.includes("--force"))
else await score(casePath)
