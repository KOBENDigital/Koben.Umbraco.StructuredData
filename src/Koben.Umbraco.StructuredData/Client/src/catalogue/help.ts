import type { Field } from "./types.js";

type HelpSource = Pick<Field, "required" | "recommended" | "description" | "example">;

export interface FieldHelp {
  /** "Required" when Google rejects the entity without it, "Recommended" when results are richer with it. */
  status?: "Required" | "Recommended";
  description?: string;
  example?: string;
}

/** The pieces of in-context help for a field, for callers that lay them out themselves. */
export function fieldHelp(field: HelpSource | undefined): FieldHelp {
  if (!field) return {};
  return {
    status: field.required ? "Required" : field.recommended ? "Recommended" : undefined,
    description: field.description,
    example: field.example,
  };
}

/**
 * One line of help for a property layout description. The backoffice renders it as markdown, so
 * the status leads in bold; pass `markdown: false` for plain text.
 */
export function fieldHelpText(field: HelpSource | undefined, options: { markdown?: boolean } = {}): string {
  const help = fieldHelp(field);
  const markdown = options.markdown ?? true;
  const parts: string[] = [];
  if (help.status) parts.push(markdown ? `**${help.status}.**` : `${help.status}.`);
  if (help.description) parts.push(help.description);
  if (help.example) parts.push(`Example: ${help.example}`);
  return parts.join(" ");
}
