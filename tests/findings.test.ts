import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { findingInput, priorityOf, type FindingInput } from "../src/findings/finding.js"
import { renderReport } from "../src/findings/report.js"
import { FindingStore } from "../src/findings/store.js"

const hypothesis: FindingInput = {
  title: "Scheme check misses control characters",
  status: "hypothesis",
  severity: "critical",
  cwe: "CWE-94",
  anchors: [{ file: "src/loader.ts", line: 42, symbol: "isAllowedSource" }],
  description: "The regex stops at a TAB, but the URL parser removes it.",
}

const reproduced: FindingInput = {
  ...hypothesis,
  status: "reproduced",
  cvss: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:N",
  score: { reachability: 2, exposure: 3, certainty: 2, impact: 2, rationale: "Default bundle, deterministic." },
  poc: { command: "node .vigia/pocs/VIGIA-001/poc.mjs", observed: "VIGIA-POC: VULNERABLE ```data:```" },
}

describe("findingInput", () => {
  it("requires a PoC for a reproduced finding", () => {
    const result = findingInput.safeParse({ ...hypothesis, status: "reproduced" })
    expect(result.success).toBe(false)
  })

  it("requires a reason for a rejected finding", () => {
    expect(findingInput.safeParse({ ...hypothesis, status: "rejected" }).success).toBe(false)
  })

  it("rejects ids that could escape the findings folder", () => {
    expect(findingInput.safeParse({ ...hypothesis, id: "../../etc/passwd" }).success).toBe(false)
  })
})

describe("priorityOf", () => {
  it.each([
    [{ reachability: 2, exposure: 3, certainty: 2, impact: 2 }, "P0"],
    [{ reachability: 2, exposure: 2, certainty: 1, impact: 2 }, "P1"],
    [{ reachability: 1, exposure: 1, certainty: 1, impact: 2 }, "P2"],
    [{ reachability: 1, exposure: 1, certainty: 1, impact: 1 }, "P3"],
    [{ reachability: 3, exposure: 3, certainty: 2, impact: 1 }, "P1"],
    [{ reachability: 3, exposure: 3, certainty: 2, impact: 0 }, "P2"],
  ])("maps %o to %s", (dimensions, priority) => {
    expect(priorityOf({ ...dimensions, rationale: "test" })).toBe(priority)
  })
})

describe("FindingStore", () => {
  it("assigns sequential ids and updates in place", async () => {
    const store = new FindingStore(await mkdtemp(join(tmpdir(), "vigia-")))

    const first = await store.save(hypothesis)
    const second = await store.save({ ...hypothesis, title: "Second" })
    await store.save({ ...reproduced, id: first.id })

    const { findings } = await store.list()
    expect([first.id, second.id]).toEqual(["VIGIA-001", "VIGIA-002"])
    expect(findings.map((finding) => [finding.id, finding.status, finding.priority])).toEqual([
      ["VIGIA-001", "reproduced", "P0"],
      ["VIGIA-002", "hypothesis", undefined],
    ])
  })

  it("gives parallel saves distinct ids and readable files", async () => {
    const store = new FindingStore(await mkdtemp(join(tmpdir(), "vigia-")))

    const saved = await Promise.all(
      Array.from({ length: 20 }, (_, index) => store.save({ ...hypothesis, title: `Parallel ${index}` })),
    )

    const { findings, unreadable } = await store.list()
    expect(new Set(saved.map((finding) => finding.id)).size).toBe(20)
    expect(findings).toHaveLength(20)
    expect(unreadable).toEqual([])
  })

  it("reports a damaged file instead of failing", async () => {
    const store = new FindingStore(await mkdtemp(join(tmpdir(), "vigia-")))
    await store.save(hypothesis)
    await writeFile(join(store.directory, "VIGIA-002.json"), '{"id": "VIGIA-002", "title": "cut\u0000')

    const { findings, unreadable } = await store.list()

    expect(findings.map((finding) => finding.id)).toEqual(["VIGIA-001"])
    expect(unreadable).toEqual(["VIGIA-002.json"])
  })
})

describe("renderReport", () => {
  it("puts proven findings first and lists hypotheses apart", async () => {
    const store = new FindingStore(await mkdtemp(join(tmpdir(), "vigia-")))
    await store.save(reproduced)
    await store.save({ ...hypothesis, title: "Unproven idea" })

    const report = renderReport((await store.list()).findings, "example-app")

    expect(report).toContain("1 proven findings, 1 open hypotheses, 0 rejected.")
    expect(report.indexOf("## Proven findings")).toBeLessThan(report.indexOf("## Open hypotheses"))
    expect(report).toContain("Priority: P0 (score 9/10: R2 E3 C2 I2)")
    expect(report).toContain("````\nVIGIA-POC: VULNERABLE ```data:```\n````")
  })
})
