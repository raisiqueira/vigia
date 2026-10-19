import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Plugin, type Skill } from "@opencode/plugin"
import { z } from "zod"
import { findingInput } from "./findings/finding.js"
import { renderReport } from "./findings/report.js"
import { FindingStore } from "./findings/store.js"
import { htmlOracle } from "./oracles/html.js"
import { urlOracle } from "./oracles/url.js"
import { runSubagentsInForeground } from "./orchestration.js"
import { enforceScope } from "./scope.js"

const SKILL_PATH = fileURLToPath(new URL("../skills/vigia-method/SKILL.md", import.meta.url))

function json(value: unknown) {
  return { content: JSON.stringify(value, null, 2) }
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, "").trimStart()
}

export default Plugin.define({
  id: "vigia",
  async setup(ctx) {
    const projectDirectory = ctx.location.directory
    const store = new FindingStore(projectDirectory)
    const skillContent = stripFrontmatter(await readFile(SKILL_PATH, "utf8"))

    await ctx.skill.transform((editor) => {
      editor.add({
        id: "vigia-method" as Skill.ID,
        name: "vigia-method" as Skill.Name,
        description:
          "Vigia method to find, prove, score, and fix security vulnerabilities in JavaScript, TypeScript, and Python web code.",
        path: SKILL_PATH as Skill.Info["path"],
        content: skillContent,
      })
    })

    await ctx.permission.hook("evaluate", (event) => enforceScope(event))
    await ctx.tool.hook("execute.before", (event) => runSubagentsInForeground(event))

    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "vigia",
        description: "Security oracles and the finding store for Vigia vulnerability scans.",
      })

      editor.add({
        name: "url",
        description: [
          "Parse a string the way a browser does (WHATWG URL Standard) and show hidden characters.",
          "With `base`, also resolve it the way `import()` resolves a module specifier, and check if the result is same-origin.",
          "With `python: true`, also parse it with Python urllib (urljoin + urlsplit) and list where the two parsers disagree.",
          "Use it to test URL allowlists, scheme checks, open redirect checks, and SSRF host checks against the real parser.",
        ].join(" "),
        input: {
          type: "object",
          properties: {
            input: { type: "string", description: "The exact string to parse. Use JSON escapes for control characters." },
            base: { type: "string", description: "Base URL, for example the page URL https://app.test/page." },
            python: { type: "boolean", description: "Also parse with Python urllib and compare." },
          },
          required: ["input"],
          additionalProperties: false,
        },
        options: { namespace: "vigia" },
        execute: async (input) => json(await urlOracle(input as { input: string; base?: string; python?: boolean })),
      })

      editor.add({
        name: "html",
        description: [
          "Parse HTML with a WHATWG-compliant parser (parse5) and report where each marker string lands:",
          "text, raw text inside <script> or <style>, attribute name or value, comment, or tag name.",
          "Use it to check if a template engine or sanitizer puts untrusted values where it thinks it does.",
          "Put a unique marker such as VIGIA_X1 where the untrusted value goes in the rendered output.",
        ].join(" "),
        input: {
          type: "object",
          properties: {
            html: { type: "string", description: "The rendered HTML to parse." },
            markers: { type: "array", items: { type: "string" }, minItems: 1, description: "Marker strings to locate." },
            fragment: { type: "boolean", description: "Parse as a body fragment instead of a full document." },
          },
          required: ["html", "markers"],
          additionalProperties: false,
        },
        options: { namespace: "vigia" },
        execute: async (input) => json(htmlOracle(input as { html: string; markers: string[]; fragment?: boolean })),
      })

      editor.add({
        name: "finding_save",
        description: [
          "Create or update a finding in .vigia/findings/.",
          "Omit `id` to create a new finding. Pass the full finding again to update it.",
          "Status `reproduced` or `confirmed` requires `poc` with the exact command and the observed output.",
        ].join(" "),
        input: z.toJSONSchema(findingInput, { io: "input" }) as Record<string, unknown>,
        options: { namespace: "vigia" },
        execute: async (input) => {
          const parsed = findingInput.safeParse(input)
          if (!parsed.success) return json({ saved: false, errors: z.prettifyError(parsed.error) })
          const finding = await store.save(parsed.data)
          return json({ saved: true, id: finding.id, priority: finding.priority ?? null })
        },
      })

      editor.add({
        name: "finding_list",
        description: [
          "List all findings in .vigia/findings/ with their status, severity, and anchors.",
          "Pass `id` to get the full finding, with the description, score, PoC, and fix.",
        ].join(" "),
        input: {
          type: "object",
          properties: { id: { type: "string", description: "A finding ID, for example VIGIA-001." } },
          additionalProperties: false,
        },
        options: { namespace: "vigia" },
        execute: async (input) => {
          const { findings, unreadable } = await store.list()
          const { id } = input as { id?: string }
          if (id) {
            const finding = findings.find((candidate) => candidate.id === id)
            return json(finding ?? { error: `No finding with id ${id}.`, unreadable })
          }
          const summaries = findings.map(({ id, title, status, severity, cwe, priority, anchors }) => ({
            id,
            title,
            status,
            severity,
            cwe,
            priority,
            anchors,
          }))
          return json(unreadable.length > 0 ? { findings: summaries, unreadable } : summaries)
        },
      })

      editor.add({
        name: "report",
        description: "Write .vigia/report.md from all findings. Proven findings come first. Hypotheses are listed apart.",
        input: { type: "object", properties: {}, additionalProperties: false },
        options: { namespace: "vigia" },
        execute: async () => {
          const { findings, unreadable } = await store.list()
          const path = join(projectDirectory, ".vigia", "report.md")
          await mkdir(join(projectDirectory, ".vigia"), { recursive: true })
          await writeFile(path, renderReport(findings, basename(projectDirectory)))
          return json({ path, findings: findings.length, unreadable })
        },
      })
    })
  },
})
