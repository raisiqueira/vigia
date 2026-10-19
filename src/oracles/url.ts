import { spawn } from "node:child_process"

export type WhatwgParse =
  | {
      ok: true
      href: string
      protocol: string
      username: string
      password: string
      host: string
      hostname: string
      port: string
      origin: string
      pathname: string
      search: string
      hash: string
    }
  | { ok: false; error: string }

export type ModuleResolution =
  | { kind: "url"; href: string; origin: string; sameOriginAsBase: boolean }
  | { kind: "bare"; note: string }

export type PythonParse =
  | { available: false; reason: string }
  | {
      available: true
      ok: true
      joined: string
      scheme: string
      netloc: string
      hostname: string | null
      path: string
      query: string
      fragment: string
    }
  | { available: true; ok: false; error: string }

export interface UnusualCharacter {
  index: number
  codePoint: string
  name: string
}

export interface UrlOracleResult {
  input: string
  base?: string
  unusualCharacters: UnusualCharacter[]
  whatwg: WhatwgParse
  moduleSpecifier?: ModuleResolution
  python?: PythonParse
  disagreements: string[]
}

const CONTROL_NAMES: Record<number, string> = {
  0x09: "TAB",
  0x0a: "LF",
  0x0c: "FF",
  0x0d: "CR",
  0x20: "SPACE",
  0x7f: "DEL",
  0xa0: "NBSP",
  0xfeff: "BOM",
  0x200b: "ZERO WIDTH SPACE",
}

export function findUnusualCharacters(input: string): UnusualCharacter[] {
  const found: UnusualCharacter[] = []
  let index = 0
  for (const char of input) {
    const code = char.codePointAt(0)!
    if (code <= 0x20 || code === 0x7f || code > 0x7e) {
      found.push({
        index,
        codePoint: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
        name: CONTROL_NAMES[code] ?? (code < 0x20 ? "C0 CONTROL" : "NON-ASCII"),
      })
    }
    index += char.length
  }
  return found
}

export function parseWhatwg(input: string, base?: string): WhatwgParse {
  try {
    const url = new URL(input, base)
    return {
      ok: true,
      href: url.href,
      protocol: url.protocol,
      username: url.username,
      password: url.password,
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/** HTML Standard "resolve a module specifier", without import maps. */
export function resolveModuleSpecifier(specifier: string, base: string): ModuleResolution {
  const isPathLike = specifier.startsWith("/") || specifier.startsWith("./") || specifier.startsWith("../")
  const parsed = parseWhatwg(specifier, isPathLike ? base : undefined)
  if (!parsed.ok) {
    return { kind: "bare", note: "Resolves only through an import map. Without a matching entry, import() throws." }
  }
  return {
    kind: "url",
    href: parsed.href,
    origin: parsed.origin,
    sameOriginAsBase: parsed.origin !== "null" && parsed.origin === new URL(base).origin,
  }
}

const PYTHON_URLSPLIT = `
import json, sys
from urllib.parse import urljoin, urlsplit
request = json.load(sys.stdin)
try:
    joined = urljoin(request["base"], request["input"]) if request.get("base") else request["input"]
    parts = urlsplit(joined)
    print(json.dumps({"ok": True, "joined": joined, "scheme": parts.scheme, "netloc": parts.netloc,
                      "hostname": parts.hostname, "path": parts.path, "query": parts.query, "fragment": parts.fragment}))
except Exception as error:
    print(json.dumps({"ok": False, "error": f"{type(error).__name__}: {error}"}))
`

export function parsePython(input: string, base?: string, timeoutMs = 5000): Promise<PythonParse> {
  return new Promise((resolve) => {
    const child = spawn("python3", ["-I", "-c", PYTHON_URLSPLIT], { timeout: timeoutMs })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.stderr.on("data", (chunk) => (stderr += chunk))
    child.on("error", (error) => resolve({ available: false, reason: error.message }))
    child.on("close", (code) => {
      if (code !== 0) return resolve({ available: false, reason: stderr.trim() || `python3 exited with code ${code}` })
      resolve({ available: true, ...JSON.parse(stdout) })
    })
    child.stdin.end(JSON.stringify({ input, base }))
  })
}

function compare(whatwg: WhatwgParse, python: PythonParse | undefined): string[] {
  if (!python?.available) return []
  if (!whatwg.ok && python.ok) return [`WHATWG rejects the URL (${whatwg.error}), but Python accepts it.`]
  if (whatwg.ok && !python.ok) return [`Python rejects the URL (${python.error}), but WHATWG accepts it.`]
  if (!whatwg.ok || !python.ok) return []

  const disagreements: string[] = []
  const whatwgScheme = whatwg.protocol.replace(/:$/, "")
  if (whatwgScheme !== python.scheme.toLowerCase()) {
    disagreements.push(`Scheme: WHATWG reads "${whatwgScheme}", Python reads "${python.scheme}".`)
  }
  if (whatwg.hostname !== (python.hostname ?? "")) {
    disagreements.push(`Host: WHATWG reads "${whatwg.hostname}", Python reads "${python.hostname ?? ""}".`)
  }
  return disagreements
}

export async function urlOracle(options: {
  input: string
  base?: string
  python?: boolean
}): Promise<UrlOracleResult> {
  const { input, base } = options
  const whatwg = parseWhatwg(input, base)
  const python = options.python ? await parsePython(input, base) : undefined
  return {
    input,
    base,
    unusualCharacters: findUnusualCharacters(input),
    whatwg,
    moduleSpecifier: base ? resolveModuleSpecifier(input, base) : undefined,
    python,
    disagreements: compare(whatwg, python),
  }
}
