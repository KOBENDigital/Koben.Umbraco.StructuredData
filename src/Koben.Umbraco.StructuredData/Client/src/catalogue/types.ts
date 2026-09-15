import type { JsonObject } from "../model.js";

export type SelectOption = { value: string; label: string };

interface FieldBase {
  /** The JSON-LD property name this field writes. */
  key: string;
  label: string;
  description?: string;
  /** Google rejects the entity without it. */
  required?: boolean;
  /** Google's rich results are richer with it. */
  recommended?: boolean;
  placeholder?: string;
}

export type ScalarFieldKind = "text" | "textarea" | "url" | "email" | "tel" | "date" | "datetime" | "number" | "duration";

export interface ScalarField extends FieldBase {
  kind: ScalarFieldKind;
}

export interface BooleanField extends FieldBase {
  kind: "boolean";
}

export interface SelectField extends FieldBase {
  kind: "select";
  options: SelectOption[];
}

export interface ImageField extends FieldBase {
  kind: "image";
  /** Emit a bare URL instead of an ImageObject (thumbnailUrl, logo as URL, …). */
  as?: "url";
}

export interface DocumentField extends FieldBase {
  kind: "document";
}

/** A URL that may be typed, or picked as a page and resolved on publish. */
export interface LinkField extends FieldBase {
  kind: "link";
}

export interface EntityField extends FieldBase {
  kind: "entity";
  /** Catalogue aliases the nested entity may be; a select appears when there is more than one. */
  types: string[];
  /** Always present and never removable: its fields render as if they were the parent's own. */
  inline?: boolean;
}

export interface ListField extends FieldBase {
  kind: "list";
  of: Omit<ScalarField, "key" | "label"> | Omit<ImageField, "key" | "label"> | Omit<LinkField, "key" | "label"> | Omit<EntityField, "key" | "label">;
  /** Write a 1-based `position` on each entity item, as ListItem and HowToStep expect. */
  autoPosition?: boolean;
  min?: number;
}

export type Field = ScalarField | BooleanField | SelectField | ImageField | DocumentField | LinkField | EntityField | ListField;

export type TypeGroup = "Pages & content" | "Organisation & people" | "Products & services" | "Events & jobs" | "Media" | "Other";

export interface TypeDefinition {
  /** The `@type` written to the node — or the catalogue alias for a variant family. */
  alias: string;
  label: string;
  description: string;
  icon: string;
  group: TypeGroup;
  /** Offered in the picker; nested-only definitions (PostalAddress, Offer…) are not. */
  topLevel: boolean;
  /** When set, the node's `@type` is chosen from these instead of being the alias. */
  typeVariants?: SelectOption[];
  fields: Field[];
  /** A shorter field set used when the entity is nested inside another. */
  nestedFields?: Field[];
  /** Which property to read for the card summary. */
  summaryKey?: string;
  /** Google's documentation for the rich result, when there is one. */
  docsUrl?: string;
  /** Starting node for a fresh entry beyond `@type`. */
  defaults?: JsonObject;
}
