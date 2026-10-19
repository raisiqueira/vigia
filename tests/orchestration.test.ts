import { describe, expect, it } from "vitest"
import { runSubagentsInForeground, type ToolCall } from "../src/orchestration.js"

function call(overrides: Partial<ToolCall>): ToolCall {
  return { tool: "subagent", agent: "vigia", input: { agent: "vigia/hunter", prompt: "Hunt", background: true }, ...overrides }
}

describe("runSubagentsInForeground", () => {
  it("runs Vigia subagents in the foreground", () => {
    const event = call({})
    runSubagentsInForeground(event)
    expect(event.input).toEqual({ agent: "vigia/hunter", prompt: "Hunt", background: false })
  })

  it("does not change other agents or tools", () => {
    const fromBuild = call({ agent: "build" })
    const shell = call({ tool: "shell", input: { command: "ls", background: true } })

    runSubagentsInForeground(fromBuild)
    runSubagentsInForeground(shell)

    expect(fromBuild.input).toMatchObject({ background: true })
    expect(shell.input).toMatchObject({ background: true })
  })
})
