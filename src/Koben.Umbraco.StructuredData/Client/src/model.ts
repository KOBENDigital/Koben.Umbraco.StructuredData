import { CURRENT_VALUE_VERSION } from "./constants.js";

/** A JSON value as the editor stores it: JSON-LD shape plus reference placeholders. */
export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Placeholder for an Umbraco item, resolved to a URL or ImageObject at publish time. */
export interface ReferenceValue {
  $ref: "media" | "document";
  key: string;
  /** `url` emits a bare URL string instead of an ImageObject; only meaningful for media. */
  as?: "url";
}

export interface StructuredDataItem {
  key: string;
  type: string;
  enabled: boolean;
  note?: string;
  node: JsonObject;
}

export interface StructuredDataValue {
  version: number;
  items: StructuredDataItem[];
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isReference(value: unknown): value is ReferenceValue {
  return (
    isJsonObject(value) &&
    (value.$ref === "media" || value.$ref === "document") &&
    typeof value.key === "string"
  );
}

export function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyValue(): StructuredDataValue {
  return { version: CURRENT_VALUE_VERSION, items: [] };
}

/**
 * Accepts whatever Umbraco hands back for the property — undefined on a new document, the parsed
 * object normally, a string if a migration ever stored it raw — and returns a well-formed value.
 */
export function normalizeValue(raw: unknown): StructuredDataValue {
  let candidate: unknown = raw;
  if (typeof candidate === "string") {
    try {
      candidate = candidate.trim() ? JSON.parse(candidate) : undefined;
    } catch {
      candidate = undefined;
    }
  }

  if (!isJsonObject(candidate) || !Array.isArray(candidate.items)) {
    return emptyValue();
  }

  const items: StructuredDataItem[] = [];
  for (const entry of candidate.items) {
    if (!isJsonObject(entry) || !isJsonObject(entry.node)) continue;
    items.push({
      key: typeof entry.key === "string" && entry.key ? entry.key : newKey(),
      type: typeof entry.type === "string" && entry.type ? entry.type : String(entry.node["@type"] ?? "custom"),
      enabled: entry.enabled !== false,
      ...(typeof entry.note === "string" && entry.note ? { note: entry.note } : {}),
      node: entry.node,
    });
  }

  return { version: CURRENT_VALUE_VERSION, items };
}

export function createItem(type: string, node: JsonObject): StructuredDataItem {
  return { key: newKey(), type, enabled: true, node };
}

/** Immutable helpers: every edit yields a new value so Lit and Umbraco both see the change. */
export function replaceItem(value: StructuredDataValue, item: StructuredDataItem): StructuredDataValue {
  return { ...value, items: value.items.map((existing) => (existing.key === item.key ? item : existing)) };
}

export function removeItem(value: StructuredDataValue, key: string): StructuredDataValue {
  return { ...value, items: value.items.filter((item) => item.key !== key) };
}

export function insertItem(value: StructuredDataValue, item: StructuredDataItem, index?: number): StructuredDataValue {
  const items = [...value.items];
  items.splice(index ?? items.length, 0, item);
  return { ...value, items };
}

export function duplicateItem(item: StructuredDataItem): StructuredDataItem {
  return { ...structuredClone(item), key: newKey() };
}
