import { isVigiaAgent } from "./scope.js"

export interface ToolCall {
  readonly tool: string
  readonly agent: string
  input: unknown
}

/**
 * `opencode run` exits when the primary session goes idle, which kills background subagents.
 * The scan must wait for hunters and verifiers, so Vigia agents run them in the foreground.
 */
export function runSubagentsInForeground(call: ToolCall): void {
  if (call.tool !== "subagent" || !isVigiaAgent(call.agent)) return
  if (typeof call.input === "object" && call.input !== null && "background" in call.input) {
    call.input = { ...call.input, background: false }
  }
}
