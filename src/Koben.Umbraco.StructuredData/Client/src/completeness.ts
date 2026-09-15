import { CUSTOM_TYPE_ALIAS } from "./constants.js";
import { getDefinition, type Field, type TypeDefinition } from "./catalogue/index.js";
import { isJsonObject, isReference, type JsonObject, type JsonValue, type StructuredDataItem } from "./model.js";

export type CompletenessLevel = "ready" | "recommended" | "incomplete" | "disabled" | "invalid";

export interface Completeness {
  level: CompletenessLevel;
  /** Labels of missing required fields, top-level and nested. */
  missing: string[];
  /** Labels of missing recommended fields, top-level only. */
  suggested: string[];
}

/** True when the value would survive the publish-time strip. */
export function hasValue(value: JsonValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(hasValue);
  if (isReference(value)) return value.key.trim().length > 0;
  if (isJsonObject(value)) return Object.entries(value).some(([key, member]) => key !== "@type" && hasValue(member));
  return false;
}

function fieldsFor(definition: TypeDefinition, nested: boolean): Field[] {
  return nested && definition.nestedFields ? definition.nestedFields : definition.fields;
}

/** An inline entity with a single field reads as that field: "Answer", not "Answer › Answer". */
function inlinePath(definition: TypeDefinition, parentPath: string, label: string): string {
  return fieldsFor(definition, true).length === 1 ? parentPath : label;
}

function collect(node: JsonObject, fields: Field[], path: string, missing: string[], suggested: string[], depth: number): void {
  for (const field of fields) {
    const value = node[field.key];
    const present = hasValue(value);
    const label = path ? `${path} › ${field.label}` : field.label;

    if (!present) {
      if (field.kind === "entity" && field.inline) {
        // The inline entity always exists; what is missing is its own required fields.
        const inlineDefinition = getDefinition(field.types[0] ?? "");
        if (inlineDefinition) collect({ "@type": inlineDefinition.alias }, fieldsFor(inlineDefinition, true), inlinePath(inlineDefinition, path, label), missing, suggested, depth + 1);
      } else if (field.required) missing.push(label);
      else if (field.recommended && depth === 0) suggested.push(label);
      continue;
    }

    if (field.kind === "list" && field.min && Array.isArray(value) && value.filter(hasValue).length < field.min) {
      missing.push(label);
    }

    // Nested entities carry their own required fields.
    if (field.kind === "entity" && isJsonObject(value)) {
      const nestedDefinition = getDefinition(String(value["@type"] ?? field.types[0]));
      if (nestedDefinition) {
        const nestedPath = field.inline ? inlinePath(nestedDefinition, path, label) : label;
        collect(value, fieldsFor(nestedDefinition, true), nestedPath, missing, suggested, depth + 1);
      }
    }

    if (field.kind === "list" && field.of.kind === "entity" && Array.isArray(value)) {
      value.forEach((member, index) => {
        if (!isJsonObject(member)) return;
        const nestedDefinition = getDefinition(String(member["@type"] ?? (field.of as { types: string[] }).types[0]));
        if (nestedDefinition) collect(member, fieldsFor(nestedDefinition, true), `${label} ${index + 1}`, missing, suggested, depth + 1);
      });
    }
  }
}

export function assess(item: StructuredDataItem): Completeness {
  if (item.type === CUSTOM_TYPE_ALIAS) {
    const valid = typeof item.node["@type"] === "string" && item.node["@type"].trim().length > 0;
    return { level: !item.enabled ? "disabled" : valid ? "ready" : "invalid", missing: valid ? [] : ["@type"], suggested: [] };
  }

  const definition = getDefinition(item.type);
  if (!definition) {
    return { level: item.enabled ? "invalid" : "disabled", missing: ["Unknown type"], suggested: [] };
  }

  const missing: string[] = [];
  const suggested: string[] = [];
  collect(item.node, definition.fields, "", missing, suggested, 0);

  const level: CompletenessLevel = !item.enabled ? "disabled" : missing.length ? "incomplete" : suggested.length ? "recommended" : "ready";
  return { level, missing, suggested };
}

/** A one-line description of an entry for its card header. */
export function summarize(item: StructuredDataItem): string {
  const definition = getDefinition(item.type);
  const key = definition?.summaryKey;
  const value = key ? item.node[key] : undefined;

  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const count = value.filter(hasValue).length;
    return count ? `${count} ${count === 1 ? "item" : "items"}` : "";
  }
  if (isJsonObject(value) && typeof value.name === "string") return value.name;

  if (item.type === CUSTOM_TYPE_ALIAS) {
    const name = item.node.name ?? item.node.headline;
    return typeof name === "string" ? name : "";
  }

  return "";
}
