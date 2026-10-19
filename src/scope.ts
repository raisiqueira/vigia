const URL_IN_TEXT = /\b[a-z][a-z0-9+.-]*:\/\/[^\s'"`<>()]+/gi
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"])

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  return LOCAL_HOSTNAMES.has(host) || host.endsWith(".localhost") || /^127\.\d+\.\d+\.\d+$/.test(host)
}

export function externalUrls(text: string): string[] {
  return (text.match(URL_IN_TEXT) ?? []).filter((candidate) => {
    try {
      return !isLocalHostname(new URL(candidate).hostname)
    } catch {
      return true
    }
  })
}

export function isVigiaAgent(agent: string | undefined): boolean {
  return agent === "vigia" || agent?.startsWith("vigia/") === true
}

export interface PermissionDecision {
  readonly agent?: string
  readonly action: string
  readonly resources: ReadonlyArray<string>
  effect: "allow" | "ask" | "deny"
  message?: string
}

/** Keeps Vigia agents on the developer's machine. It is a guard rail, not a sandbox. */
export function enforceScope(decision: PermissionDecision): void {
  if (!isVigiaAgent(decision.agent)) return
  const external = decision.resources.flatMap(externalUrls)

  if (decision.action === "websearch") {
    decision.effect = "deny"
    decision.message = "Vigia agents do not search the web, so that project code stays on this machine."
  } else if (external.length === 0) {
    return
  } else if (decision.action === "shell") {
    if (decision.effect === "allow") decision.effect = "ask"
    decision.message = `This command contacts a host that is not local: ${external.join(", ")}`
  } else {
    decision.effect = "deny"
    decision.message = `Vigia agents contact only local targets. Blocked: ${external.join(", ")}`
  }
}
