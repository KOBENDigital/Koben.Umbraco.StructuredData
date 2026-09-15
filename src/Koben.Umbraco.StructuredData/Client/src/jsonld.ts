import { SCHEMA_ORG_CONTEXT } from "./constants.js";
import { isJsonObject, isReference, type JsonObject, type JsonValue, type ReferenceValue, type StructuredDataValue } from "./model.js";

/** What the editor knows about a referenced Umbraco item; the server does the real resolution. */
export interface ResolvedReference {
  url?: string;
  width?: number;
  height?: number;
}

export type ReferenceLookup = (reference: ReferenceValue) => ResolvedReference | undefined;

/**
 * The preview transform: the same rules the C# resolver applies at publish time — disabled entries
 * dropped, blanks and empty entities stripped, references resolved, `@context` first — so the
 * editor sees what the site will emit. Unresolvable references show a placeholder rather than
 * vanishing, because a missing image is worth noticing while editing.
 */
export function toJsonLd(value: StructuredDataValue, lookup: ReferenceLookup = () => undefined): JsonObject[] {
  const nodes: JsonObject[] = [];
  for (const item of value.items) {
    if (!item.enabled) continue;
    const resolved = resolveNode(item.node, lookup);
    if (!isJsonObject(resolved) || typeof resolved["@type"] !== "string") continue;
    const { "@context": _context, ...rest } = resolved;
    nodes.push({ "@context": SCHEMA_ORG_CONTEXT, ...rest });
  }
  return nodes;
}

function resolveNode(node: JsonValue, lookup: ReferenceLookup): JsonValue | undefined {
  if (node === null || node === undefined) return undefined;

  if (isReference(node)) return resolveReference(node, lookup);

  if (Array.isArray(node)) {
    const kept = node.map((member) => resolveNode(member, lookup)).filter((member): member is JsonValue => member !== undefined);
    return kept.length ? kept : undefined;
  }

  if (isJsonObject(node)) {
    const result: JsonObject = {};
    for (const [key, member] of Object.entries(node)) {
      const resolved = resolveNode(member, lookup);
      if (resolved !== undefined) result[key] = resolved;
    }
    const hasContent = Object.keys(result).some((key) => key !== "@type" && key !== "@context");
    return hasContent ? result : undefined;
  }

  if (typeof node === "string") {
    const trimmed = node.trim();
    return trimmed ? trimmed : undefined;
  }

  return node;
}

function resolveReference(reference: ReferenceValue, lookup: ReferenceLookup): JsonValue | undefined {
  const resolved = lookup(reference);
  if (reference.$ref === "document") {
    return resolved?.url ?? `(page ${reference.key})`;
  }

  const url = resolved?.url ?? `(media ${reference.key})`;
  if (reference.as === "url") return url;

  const image: JsonObject = { "@type": "ImageObject", url };
  if (resolved?.width && resolved.height) {
    image.width = resolved.width;
    image.height = resolved.height;
  }
  return image;
}

/** Serialises for display inside a `<script>`-like context: `<` is escaped as the site will do. */
export function formatJsonLd(nodes: JsonObject[]): string {
  const payload: JsonValue = nodes.length === 1 && nodes[0] ? nodes[0] : nodes;
  return JSON.stringify(payload, null, 2).replace(/</g, "\\u003c");
}
