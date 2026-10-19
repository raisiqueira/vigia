# How it works

Vigia has two parts:

- **The plugin** (`opencode-vigia`) adds tools, a skill, and hooks to OpenCode.
- **The agents** are Markdown files that `vigia init` copies into `.opencode/agents/`. The OpenCode plugin API cannot add agents, so Vigia ships them as files. You can edit them.

## Stages

| Stage | Agent | Output |
| --- | --- | --- |
| 1. Map | `vigia` | `.vigia/surface.md`: the entry points, the trust boundaries, and the security checks |
| 2. Hunt | `vigia/hunter`, one for each area | Findings with the status `hypothesis` or `rejected` |
| 3. Prove | `vigia/verifier`, one for each hypothesis | A PoC in `.vigia/pocs/<ID>/`, and the status `reproduced` or `rejected` |
| 4. Score | `vigia/verifier` | The exploitability score, the severity, a CVSS vector, and a proposed fix |
| 5. Report | `vigia` | `.vigia/report.md` |
| 6. Fix | `vigia`, only when you ask | The patch and the regression test, applied to your code |

The hunters and the verifiers run in parallel. A hook in the plugin makes sure that they run in the foreground. With `opencode run`, OpenCode exits when the main session becomes idle, and that would stop subagents that run in the background.

## Agents and permissions

| Agent | Can edit | Can run shell commands | Can start subagents |
| --- | --- | --- | --- |
| `vigia` | `.vigia/` only. It asks for other files. | Asks first | `vigia/*` only |
| `vigia/hunter` | No | No | No |
| `vigia/verifier` | `.vigia/` only | Asks first | No |

No Vigia agent can search the web. The scope guard also blocks fetches and browser navigation to hosts other than `localhost`, and asks before a shell command that contains such a host.

## Tools

| Tool | Purpose |
| --- | --- |
| `vigia_url` | Parses a string with the WHATWG URL parser, the parser that browsers use. It shows hidden characters, resolves the string as an `import()` specifier against a base URL, and compares the result with Python `urllib`. |
| `vigia_html` | Parses HTML with parse5, a WHATWG-compliant parser. It shows where each marker string lands: text, raw text in `<script>` or `<style>`, an attribute name or value, a comment, or a tag name. |
| `vigia_finding_save` | Creates or updates a finding. It rejects a `reproduced` or `confirmed` finding that has no PoC, and a `rejected` finding that has no reason. |
| `vigia_finding_list` | Lists the findings, or returns one full finding by ID. |
| `vigia_report` | Writes `.vigia/report.md`. |

The parser tools are called oracles. When the model asks "How does the browser read this string?", the oracle gives the real answer. Many vulnerabilities are a disagreement between a check and the parser that runs after it:

- A scheme check with a regex, and a URL parser that removes TAB characters before it reads the scheme.
- A template scanner that ends `<script>` at `</script>`, and an HTML tokenizer that has script data escape states.
- A check that uses JavaScript `/\s/`, which matches NBSP, and an HTML tokenizer that uses ASCII whitespace only.

## Findings

Each finding is a JSON file in `.vigia/findings/`. Its status is one of these:

| Status | Meaning |
| --- | --- |
| `hypothesis` | A possible bug. No PoC has run. |
| `reproduced` | A PoC ran and showed the bug. |
| `confirmed` | The impact was also shown in an app that uses the code like a real consumer does. |
| `rejected` | The PoC did not show the bug, or the bug has no impact. The finding has a reason. |

A rejected finding is a useful result. It shows what was checked, and it keeps false positives out of the report.

## Exploitability score

The verifier gives four values:

| Dimension | Range | Meaning of the highest value |
| --- | --- | --- |
| Reachability | 0–3 | Remote input without authentication |
| Exposure | 0–3 | In the default configuration of every install |
| Certainty | 0–2 | Deterministic, works every time |
| Impact | 0–2 | Code execution, account takeover, or full data access |

The tool calculates the priority from the total: 9–10 is P0, 7–8 is P1, 5–6 is P2, and 0–4 is P3. Impact limits the priority. With Impact 1, the highest priority is P1. With Impact 0, it is P2. Thus a bug that is easy to reach but has a low impact, such as an open redirect, cannot become P0.

## The method skill

The `vigia-method` skill holds the rules, the stages, a list of places to look in JavaScript, TypeScript, and Python code, the PoC rules, and the score. All Vigia agents load it. You can also load it from other agents.
