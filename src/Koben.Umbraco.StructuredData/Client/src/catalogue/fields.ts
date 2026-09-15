import type {
  BooleanField,
  DocumentField,
  EntityField,
  Field,
  ImageField,
  LinkField,
  ListField,
  ScalarField,
  ScalarFieldKind,
  SelectField,
  SelectOption,
} from "./types.js";

type Flags = Partial<Pick<Field, "required" | "recommended" | "description" | "placeholder" | "example">>;

function scalar(kind: ScalarFieldKind) {
  return (key: string, label: string, flags: Flags = {}): ScalarField => ({ kind, key, label, ...flags });
}

export const text = scalar("text");
export const textarea = scalar("textarea");
export const url = scalar("url");
export const email = scalar("email");
export const tel = scalar("tel");
export const date = scalar("date");
export const datetime = scalar("datetime");
export const number = scalar("number");
export const duration = scalar("duration");

export const boolean = (key: string, label: string, flags: Flags = {}): BooleanField => ({ kind: "boolean", key, label, ...flags });

export const select = (key: string, label: string, options: SelectOption[], flags: Flags = {}): SelectField => ({
  kind: "select",
  key,
  label,
  options,
  ...flags,
});

export const image = (key: string, label: string, flags: Flags & { as?: "url" } = {}): ImageField => ({ kind: "image", key, label, ...flags });
export const document = (key: string, label: string, flags: Flags = {}): DocumentField => ({ kind: "document", key, label, ...flags });
export const link = (key: string, label: string, flags: Flags = {}): LinkField => ({ kind: "link", key, label, ...flags });

export const entity = (key: string, label: string, types: string[], flags: Flags & { inline?: boolean } = {}): EntityField => ({
  kind: "entity",
  key,
  label,
  types,
  ...flags,
});

export const list = (key: string, label: string, of: ListField["of"], flags: Flags & { autoPosition?: boolean; min?: number } = {}): ListField => ({
  kind: "list",
  key,
  label,
  of,
  ...flags,
});

/** Shorthands for the common list member shapes. */
export const ofText = (flags: Flags = {}): ListField["of"] => ({ kind: "text", ...flags });
export const ofUrl = (flags: Flags = {}): ListField["of"] => ({ kind: "url", ...flags });
export const ofImage = (flags: Flags & { as?: "url" } = {}): ListField["of"] => ({ kind: "image", ...flags });
export const ofLink = (flags: Flags = {}): ListField["of"] => ({ kind: "link", ...flags });
export const ofEntity = (types: string[], flags: Flags = {}): ListField["of"] => ({ kind: "entity", types, ...flags });

export const options = (...values: Array<string | [string, string]>): SelectOption[] =>
  values.map((entry) => (Array.isArray(entry) ? { value: entry[0], label: entry[1] } : { value: entry, label: entry }));
