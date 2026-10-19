import { randomUUID } from "node:crypto"
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { FINDING_ID_PATTERN, priorityOf, type Finding, type FindingInput } from "./finding.js"

export interface FindingList {
  findings: Finding[]
  unreadable: string[]
}

export class FindingStore {
  readonly directory: string

  constructor(projectDirectory: string) {
    this.directory = join(projectDirectory, ".vigia", "findings")
  }

  async list(): Promise<FindingList> {
    const files = (await readdir(this.directory).catch(() => [] as string[])).filter((file) =>
      FINDING_ID_PATTERN.test(file.replace(/\.json$/, "")),
    )
    const findings: Finding[] = []
    const unreadable: string[] = []
    for (const file of files) {
      try {
        const content = await readFile(join(this.directory, file), "utf8")
        if (content === "") continue
        findings.push(JSON.parse(content) as Finding)
      } catch {
        unreadable.push(file)
      }
    }
    findings.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
    return { findings, unreadable }
  }

  async save(input: FindingInput): Promise<Finding> {
    await mkdir(this.directory, { recursive: true })
    const id = input.id ?? (await this.claimNextId())
    const finding: Finding = { ...input, id, priority: priorityOf(input.score), updatedAt: new Date().toISOString() }
    const target = join(this.directory, `${id}.json`)
    const temporary = `${target}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(finding, null, 2)}\n`)
    await rename(temporary, target)
    return finding
  }

  /** Parallel hunters save at the same time, so the ID is claimed by creating its file exclusively. */
  private async claimNextId(): Promise<string> {
    const taken = (await readdir(this.directory))
      .map((file) => /^VIGIA-(\d+)\.json$/.exec(file)?.[1])
      .filter((number): number is string => number !== undefined)
      .map(Number)
    for (let number = Math.max(0, ...taken) + 1; ; number++) {
      const id = `VIGIA-${String(number).padStart(3, "0")}`
      try {
        await writeFile(join(this.directory, `${id}.json`), "", { flag: "wx" })
        return id
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      }
    }
  }
}
