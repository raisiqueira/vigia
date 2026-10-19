import { describe, expect, it } from "vitest"
import { htmlOracle } from "../src/oracles/html.js"

describe("htmlOracle", () => {
  it("keeps a value inside <script> after a double-escaped </script>", () => {
    const html = "<script><!-- <script> </script> VIGIA_X1</script><p>after</p>"

    const result = htmlOracle({ html, markers: ["VIGIA_X1"] })

    expect(result.markers.VIGIA_X1).toEqual([
      { context: "raw-text", path: "html > head > script", element: "script", executable: true },
    ])
    expect(result.scripts).toHaveLength(1)
  })

  it("reads NBSP as part of the tag name, not as whitespace", () => {
    const result = htmlOracle({ html: "<img src=VIGIA_N>", markers: ["VIGIA_N"], fragment: true })

    expect(result.markers.VIGIA_N).toMatchObject([{ context: "tag-name" }])
  })

  it("flags URL and event handler attributes as executable", () => {
    const result = htmlOracle({
      html: '<a href="VIGIA_U" title="VIGIA_T" onclick="VIGIA_E">x</a>',
      markers: ["VIGIA_U", "VIGIA_T", "VIGIA_E"],
      fragment: true,
    })

    expect(result.markers.VIGIA_U).toMatchObject([{ context: "attribute-value", attribute: "href", executable: true }])
    expect(result.markers.VIGIA_T).toMatchObject([{ context: "attribute-value", attribute: "title", executable: false }])
    expect(result.markers.VIGIA_E).toMatchObject([{ context: "attribute-value", attribute: "onclick", executable: true }])
  })

  it("separates text, RCDATA, and comments", () => {
    const result = htmlOracle({
      html: "<p>VIGIA_A</p><textarea>VIGIA_B</textarea><!-- VIGIA_C -->",
      markers: ["VIGIA_A", "VIGIA_B", "VIGIA_C", "VIGIA_MISSING"],
      fragment: true,
    })

    expect(result.markers.VIGIA_A).toMatchObject([{ context: "text", element: "p" }])
    expect(result.markers.VIGIA_B).toMatchObject([{ context: "escapable-raw-text", element: "textarea" }])
    expect(result.markers.VIGIA_C).toMatchObject([{ context: "comment" }])
    expect(result.lostMarkers).toEqual(["VIGIA_MISSING"])
  })

  it("looks inside <template> content", () => {
    const result = htmlOracle({ html: "<template><b>VIGIA_T</b></template>", markers: ["VIGIA_T"], fragment: true })

    expect(result.markers.VIGIA_T).toMatchObject([{ context: "text", element: "b" }])
  })
})
