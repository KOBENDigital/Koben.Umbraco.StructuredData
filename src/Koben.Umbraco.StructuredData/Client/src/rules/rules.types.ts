import type { JsonObject, JsonValue } from "../model.js";

export type RuleScope = "site" | "documentTypes";

/** A binding describes where one JSON-LD property's value comes from at read time. */
export type Binding =
  | { source: "property"; alias: string; fallbackAliases?: string[]; scope?: "site"; format?: "auto" | "name" | "url" }
  | { source: "value"; value: JsonValue; cultureValues?: { [isoCode: string]: JsonValue } }
  | { source: "dictionary"; key: string }
  | { source: "url" }
  | { source: "name" }
  | { source: "createDate" }
  | { source: "updateDate" }
  | { source: "breadcrumb" }
  | { source: "children" }
  | { source: "ref"; target: RefTarget }
  | { source: "id"; target: RefTarget }
  | { source: "entity"; "@type": string; fields: BindingFields }
  | { source: "list"; items: Binding[] };

export type RefTarget = "organization" | "website" | "webpage";

export type BindingFields = { [property: string]: Binding };

export interface RuleDefinition {
  "@type": string;
  fields: BindingFields;
}

export interface RuleSiteRef {
  key: string;
  name?: string | null;
}

export interface RuleModel {
  key?: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  scope: RuleScope;
  documentTypeAliases: string[];
  /** Site roots the rule is limited to; empty means every site. */
  sites: RuleSiteRef[];
  /** Culture ISO codes the rule is limited to; empty means every culture. */
  cultures: string[];
  definition: RuleDefinition;
}

export interface SiteModel {
  key: string;
  name: string;
  domains: Array<{ domainName: string; culture?: string | null }>;
}

export interface CultureModel {
  isoCode: string;
  name: string;
  isDefault: boolean;
}

export interface DocumentTypeModel {
  alias: string;
  name: string;
  icon?: string | null;
  isElement: boolean;
  properties: Array<{ alias: string; name: string; editorAlias: string }>;
}

export interface NodesResponse {
  nodes: JsonObject[];
}

export interface RulesExport {
  version: number;
  rules: RuleModel[];
}

export function isBinding(value: unknown): value is Binding {
  return typeof value === "object" && value !== null && typeof (value as { source?: unknown }).source === "string";
}

export function newRule(): RuleModel {
  return {
    name: "",
    enabled: true,
    sortOrder: 0,
    scope: "site",
    documentTypeAliases: [],
    sites: [],
    cultures: [],
    definition: { "@type": "WebPage", fields: {} },
  };
}
