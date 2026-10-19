import { describe, expect, it } from "vitest"
import { enforceScope, externalUrls, type PermissionDecision } from "../src/scope.js"

function decide(decision: PermissionDecision): PermissionDecision {
  enforceScope(decision)
  return decision
}

describe("externalUrls", () => {
  it("keeps only hosts that are not local", () => {
    const text = "curl http://localhost:3000/a http://127.0.0.2/b http://app.localhost/c https://example.com/d"
    expect(externalUrls(text)).toEqual(["https://example.com/d"])
  })
})

describe("enforceScope", () => {
  it("denies fetches to hosts that are not local", () => {
    const decision = decide({ agent: "vigia/verifier", action: "webfetch", resources: ["https://example.com"], effect: "allow" })
    expect(decision.effect).toBe("deny")
  })

  it("denies browser navigation to hosts that are not local", () => {
    const decision = decide({ agent: "vigia", action: "browser", resources: ["https://example.com/login"], effect: "ask" })
    expect(decision.effect).toBe("deny")
  })

  it("allows local targets", () => {
    const decision = decide({ agent: "vigia", action: "webfetch", resources: ["http://localhost:8000/"], effect: "allow" })
    expect(decision.effect).toBe("allow")
  })

  it("asks before a shell command that contacts another host", () => {
    const decision = decide({
      agent: "vigia/verifier",
      action: "shell",
      resources: ["curl -s https://example.com/x"],
      effect: "allow",
    })
    expect(decision.effect).toBe("ask")
  })

  it("denies web search", () => {
    expect(decide({ agent: "vigia/hunter", action: "websearch", resources: ["*"], effect: "allow" }).effect).toBe("deny")
  })

  it("does not touch other agents", () => {
    const decision = decide({ agent: "build", action: "webfetch", resources: ["https://example.com"], effect: "allow" })
    expect(decision.effect).toBe("allow")
  })
})
