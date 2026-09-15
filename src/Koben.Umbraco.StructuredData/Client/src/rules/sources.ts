import type { Field } from "../catalogue/index.js";
import type { Binding } from "./rules.types.js";

export type SourceName = Binding["source"];

export type SourceOption = { value: SourceName | ""; label: string };

/** One sentence per source, shown under the source picker and in the rule editor's reference. */
export const SOURCE_HELP: Record<SourceName, string> = {
  property: "Reads a field of the page. A dot path walks into picked content (author.name); fallbacks are tried in order when the field is empty; site scope reads the site root instead of this page.",
  value: "The same fixed text or number on every page. With more than one language, each language can have its own value.",
  dictionary: "An Umbraco dictionary item, translated into the language being served, falling back to the default language.",
  url: "The page's own URL in the language being served, made absolute for the site.",
  name: "The document's name in the content tree.",
  createDate: "When the document was created, as ISO 8601.",
  updateDate: "When the document was last saved, as ISO 8601.",
  breadcrumb: "A list item for each ancestor, home page first, ending with this page. Use it for a Breadcrumb's trail.",
  children: "A list item for each published child page, in tree order. Use it for an Item list's items.",
  ref: "Points at the site's Organisation, Website or this page by @id, so search engines link the entities instead of reading a copy.",
  id: "Gives this entity a stable @id that other rules can reference.",
  entity: "Builds a nested entity with its own type and bindings, for example a Person for an author.",
  list: "An array of nested entities, each with its own bindings.",
};

const COMMON: SourceOption[] = [
  { value: "", label: "Not set" },
  { value: "property", label: "Page property" },
  { value: "value", label: "Fixed value" },
  { value: "dictionary", label: "Dictionary item (translated)" },
];
const PAGE: SourceOption[] = [
  { value: "url", label: "Page URL" },
  { value: "name", label: "Page name" },
  { value: "createDate", label: "Created date" },
  { value: "updateDate", label: "Last updated date" },
];
const ENTITYISH: SourceOption[] = [
  { value: "entity", label: "Nested entity" },
  { value: "ref", label: "Reference (@id)" },
];
const LISTISH: SourceOption[] = [
  { value: "breadcrumb", label: "Breadcrumb trail (ancestors)" },
  { value: "children", label: "Child pages" },
  { value: "list", label: "List of entities" },
];

/** The sources that make sense for a catalogue field of this kind; every source for a custom key. */
export function sourceOptions(field: Field | undefined): SourceOption[] {
  switch (field?.kind) {
    case "entity":
      return [...COMMON, ...ENTITYISH];
    case "list":
      return [...COMMON, ...LISTISH, { value: "entity", label: "Single nested entity" }];
    case "image":
    case "document":
    case "link":
      return [...COMMON, { value: "url", label: "Page URL" }];
    case "boolean":
    case "select":
    case "number":
      return COMMON;
    case undefined:
      return [...COMMON, ...PAGE, ...ENTITYISH, ...LISTISH, { value: "id", label: "Identifier (@id)" }];
    default:
      return [...COMMON, ...PAGE];
  }
}

/** A short human reading of a binding, for "Usually: …" suggestions and summaries. */
export function describeBinding(binding: Binding): string {
  switch (binding.source) {
    case "property":
      return binding.alias ? `Page property ${binding.alias}${binding.scope === "site" ? " (site root)" : ""}` : `A page property you choose${binding.scope === "site" ? ", read from the site root" : ""}`;
    case "value":
      return binding.value === "" ? "A fixed value you type" : `Fixed value “${String(binding.value)}”`;
    case "dictionary":
      return binding.key ? `Dictionary item ${binding.key}` : "A dictionary item";
    case "url":
      return "Page URL";
    case "name":
      return "Page name";
    case "createDate":
      return "Created date";
    case "updateDate":
      return "Last updated date";
    case "breadcrumb":
      return "Breadcrumb trail";
    case "children":
      return "Child pages";
    case "ref":
      return binding.target === "organization" ? "Reference to the site's Organisation" : binding.target === "website" ? "Reference to the site's Website" : "Reference to this page";
    case "id":
      return "This entity's @id";
    case "entity":
      return `Nested ${binding["@type"]}`;
    case "list":
      return "List of entities";
  }
}
