import { parse, parseFragment, type DefaultTreeAdapterTypes } from "parse5"

type Node = DefaultTreeAdapterTypes.Node
type Element = DefaultTreeAdapterTypes.Element

export type MarkerContext =
  | "text"
  | "raw-text"
  | "escapable-raw-text"
  | "attribute-name"
  | "attribute-value"
  | "comment"
  | "tag-name"

export interface MarkerLocation {
  context: MarkerContext
  path: string
  element?: string
  attribute?: string
  executable: boolean
}

export interface ScriptElement {
  path: string
  attributes: Record<string, string>
  text: string
}

export interface HtmlOracleResult {
  markers: Record<string, MarkerLocation[]>
  lostMarkers: string[]
  scripts: ScriptElement[]
}

const RAW_TEXT_ELEMENTS = new Set(["script", "style", "xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"])
const ESCAPABLE_RAW_TEXT_ELEMENTS = new Set(["textarea", "title"])
const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction", "xlink:href", "srcdoc", "data", "poster"])
const SCRIPT_TEXT_PREVIEW_LENGTH = 400

function isElement(node: Node): node is Element {
  return "tagName" in node
}

function childrenOf(node: Node): Node[] {
  if (isElement(node) && node.tagName === "template") {
    return (node as DefaultTreeAdapterTypes.Template).content.childNodes
  }
  return "childNodes" in node ? node.childNodes : []
}

function isExecutableAttribute(element: string, attribute: string): boolean {
  return attribute.startsWith("on") || attribute === "style" || URL_ATTRIBUTES.has(attribute) ||
    (element === "meta" && attribute === "content")
}

function textContext(parent: Element | undefined): MarkerContext {
  if (parent && RAW_TEXT_ELEMENTS.has(parent.tagName)) return "raw-text"
  if (parent && ESCAPABLE_RAW_TEXT_ELEMENTS.has(parent.tagName)) return "escapable-raw-text"
  return "text"
}

export function htmlOracle(options: { html: string; markers: string[]; fragment?: boolean }): HtmlOracleResult {
  const root = options.fragment ? parseFragment(options.html) : parse(options.html)
  const markers: Record<string, MarkerLocation[]> = Object.fromEntries(options.markers.map((marker) => [marker, []]))
  const scripts: ScriptElement[] = []

  function record(value: string, location: MarkerLocation) {
    const parserLowercases = location.context === "tag-name" || location.context === "attribute-name"
    for (const marker of options.markers) {
      const found = parserLowercases ? value.includes(marker.toLowerCase()) : value.includes(marker)
      if (found) markers[marker]!.push(location)
    }
  }

  function visit(node: Node, ancestors: Element[]) {
    const parent = ancestors.at(-1)
    const path = ancestors.map((element) => element.tagName).join(" > ")

    if (node.nodeName === "#text") {
      const context = textContext(parent)
      record((node as DefaultTreeAdapterTypes.TextNode).value, {
        context,
        path,
        element: parent?.tagName,
        executable: parent?.tagName === "script" || parent?.tagName === "style",
      })
      return
    }

    if (node.nodeName === "#comment") {
      record((node as DefaultTreeAdapterTypes.CommentNode).data, { context: "comment", path, executable: false })
      return
    }

    if (!isElement(node)) {
      for (const child of childrenOf(node)) visit(child, ancestors)
      return
    }

    const elementPath = path ? `${path} > ${node.tagName}` : node.tagName
    record(node.tagName, { context: "tag-name", path: elementPath, element: node.tagName, executable: true })
    for (const attribute of node.attrs) {
      record(attribute.name, {
        context: "attribute-name",
        path: elementPath,
        element: node.tagName,
        attribute: attribute.name,
        executable: true,
      })
      record(attribute.value, {
        context: "attribute-value",
        path: elementPath,
        element: node.tagName,
        attribute: attribute.name,
        executable: isExecutableAttribute(node.tagName, attribute.name),
      })
    }

    if (node.tagName === "script") {
      const text = node.childNodes
        .map((child) => (child.nodeName === "#text" ? (child as DefaultTreeAdapterTypes.TextNode).value : ""))
        .join("")
      scripts.push({
        path: elementPath,
        attributes: Object.fromEntries(node.attrs.map((attribute) => [attribute.name, attribute.value])),
        text: text.length > SCRIPT_TEXT_PREVIEW_LENGTH ? `${text.slice(0, SCRIPT_TEXT_PREVIEW_LENGTH)}…` : text,
      })
    }

    for (const child of childrenOf(node)) visit(child, [...ancestors, node])
  }

  visit(root, [])

  return {
    markers,
    lostMarkers: options.markers.filter((marker) => markers[marker]!.length === 0),
    scripts,
  }
}
