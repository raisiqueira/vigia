import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"
import { findUnusualCharacters, resolveModuleSpecifier, urlOracle } from "../src/oracles/url.js"

const PAGE = "https://app.test/page"
const hasPython = spawnSync("python3", ["--version"]).status === 0

describe("WHATWG parse", () => {
  it("reads a scheme that a raw-string regex misses because of a TAB", async () => {
    const smuggled = "da\tta:text/javascript,alert(1)"
    expect(/^([a-z][a-z0-9+.-]*):/i.test(smuggled)).toBe(false)

    const result = await urlOracle({ input: smuggled, base: PAGE })

    expect(result.whatwg).toMatchObject({ ok: true, protocol: "data:" })
    expect(result.unusualCharacters).toEqual([{ index: 2, codePoint: "U+0009", name: "TAB" }])
    expect(result.moduleSpecifier).toMatchObject({ kind: "url", origin: "null", sameOriginAsBase: false })
  })

  it("names hidden characters", () => {
    expect(findUnusualCharacters("a b\u0001").map((character) => character.name)).toEqual(["NBSP", "C0 CONTROL"])
  })
})

describe("module specifier resolution", () => {
  it.each([
    ["./island.js", true],
    ["/assets/island.js", true],
    ["//evil.test/x.js", false],
    ["/\\evil.test/x.js", false],
    ["https://evil.test/x.js", false],
  ])("resolves %s with sameOriginAsBase=%s", (specifier, sameOrigin) => {
    expect(resolveModuleSpecifier(specifier, PAGE)).toMatchObject({ kind: "url", sameOriginAsBase: sameOrigin })
  })

  it("treats a bare name as an import map lookup", () => {
    expect(resolveModuleSpecifier("lodash", PAGE).kind).toBe("bare")
  })
})

describe.skipIf(!hasPython)("Python differential", () => {
  it("finds the backslash open redirect that urljoin does not see", async () => {
    const result = await urlOracle({ input: "/\\evil.test/", base: PAGE, python: true })

    expect(result.whatwg).toMatchObject({ ok: true, hostname: "evil.test" })
    expect(result.python).toMatchObject({ available: true, ok: true, hostname: "app.test" })
    expect(result.disagreements).toEqual(['Host: WHATWG reads "evil.test", Python reads "app.test".'])
  })

  it("reports no disagreement for a plain relative path", async () => {
    const result = await urlOracle({ input: "/account", base: PAGE, python: true })
    expect(result.disagreements).toEqual([])
  })
})
