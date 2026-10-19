import { totalScore, type Finding } from "./finding.js"

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]

function bySeverity(a: Finding, b: Finding): number {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.id.localeCompare(b.id)
}

function fence(text: string): string {
  const longestRun = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const marker = "`".repeat(longestRun + 1)
  return `${marker}\n${text}\n${marker}`
}

function renderFinding(finding: Finding): string {
  const lines = [
    `### ${finding.id}: ${finding.title}`,
    "",
    `- Severity: ${finding.severity}`,
    `- Status: ${finding.status}`,
    `- CWE: ${finding.cwe}`,
  ]
  if (finding.cvss) lines.push(`- CVSS: \`${finding.cvss}\``)
  if (finding.score) {
    const { reachability, exposure, certainty, impact } = finding.score
    lines.push(
      `- Priority: ${finding.priority} (score ${totalScore(finding.score)}/10: R${reachability} E${exposure} C${certainty} I${impact})`,
    )
  }
  lines.push("", "| File | Line | Symbol |", "| --- | ---: | --- |")
  for (const anchor of finding.anchors) {
    lines.push(`| \`${anchor.file}\` | ${anchor.line} | ${anchor.symbol ?? ""} |`)
  }
  lines.push("", "#### Description", "", finding.description)
  if (finding.preconditions) lines.push("", "#### Preconditions", "", finding.preconditions)
  if (finding.score) lines.push("", "#### Exploitability", "", finding.score.rationale)
  if (finding.poc) {
    lines.push("", "#### Proof of concept", "")
    if (finding.poc.path) lines.push(`File: \`${finding.poc.path}\``, "")
    lines.push(fence(`$ ${finding.poc.command}`), "", "Observed:", "", fence(finding.poc.observed))
  }
  if (finding.fix) {
    lines.push("", "#### Fix", "", finding.fix.summary)
    if (finding.fix.patch) lines.push("", fence(finding.fix.patch))
    if (finding.fix.regressionTest) lines.push("", "Regression test:", "", fence(finding.fix.regressionTest))
  }
  return lines.join("\n")
}

function renderSummaryTable(findings: Finding[]): string {
  const rows = findings.map(
    (finding) =>
      `| ${finding.id} | ${finding.severity} | ${finding.priority ?? "-"} | ${finding.status} | ${finding.cwe} | ${finding.title.replaceAll("|", "\\|")} |`,
  )
  return ["| ID | Severity | Priority | Status | CWE | Title |", "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n")
}

export function renderReport(findings: Finding[], projectName: string): string {
  const proven = findings.filter((f) => f.status === "reproduced" || f.status === "confirmed").sort(bySeverity)
  const hypotheses = findings.filter((f) => f.status === "hypothesis").sort(bySeverity)
  const rejected = findings.filter((f) => f.status === "rejected")

  const sections = [
    `# Vigia report: ${projectName}`,
    "",
    `${proven.length} proven findings, ${hypotheses.length} open hypotheses, ${rejected.length} rejected.`,
  ]
  if (proven.length > 0) {
    sections.push("", "## Proven findings", "", renderSummaryTable(proven), "", ...proven.map((f) => `${renderFinding(f)}\n`))
  }
  if (hypotheses.length > 0) {
    sections.push(
      "",
      "## Open hypotheses",
      "",
      "No PoC has reproduced these yet. Do not treat them as vulnerabilities.",
      "",
      renderSummaryTable(hypotheses),
    )
  }
  if (rejected.length > 0) {
    sections.push(
      "",
      "## Rejected",
      "",
      ...rejected.map((f) => `- ${f.id}: ${f.title}. Reason: ${f.rejectedReason}`),
    )
  }
  return `${sections.join("\n")}\n`
}
