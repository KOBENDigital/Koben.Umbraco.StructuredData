import { describe, expect, it } from "vitest";
import { getDefinition, type Field } from "../catalogue/index.js";
import { sourceOptions } from "./sources.js";
import { EXTRA_KEY_HELP, ruleFromTemplate, STARTER_TYPES, suggestionFor, templates } from "./templates.js";
import type { Binding, BindingFields } from "./rules.types.js";

function fieldsOf(type: string, nested: boolean): Field[] {
  const definition = getDefinition(type);
  if (!definition) throw new Error(`Unknown type ${type}`);
  return nested && definition.nestedFields ? definition.nestedFields : definition.fields;
}

function check(type: string, fields: BindingFields, nested: boolean, path: string) {
  const catalogueFields = fieldsOf(type, nested);
  for (const [key, binding] of Object.entries(fields)) {
    const field = catalogueFields.find((entry) => entry.key === key);
    if (!field) {
      expect(EXTRA_KEY_HELP[key], `${path}.${key} is neither a catalogue field of ${type} nor a documented extra key`).toBeDefined();
    }
    const allowed = sourceOptions(field).map((option) => option.value);
    expect(allowed, `${path}.${key}: source "${binding.source}" is not offered for a ${field?.kind ?? "custom"} field`).toContain(binding.source);
    if (binding.source === "entity") check(binding["@type"], binding.fields, true, `${path}.${key}`);
  }
}

describe("rule templates", () => {
  for (const [type, template] of Object.entries(templates)) {
    it(`${type} binds only known properties with sources the editor offers`, () => {
      expect(getDefinition(type)?.topLevel, `${type} should be a top-level catalogue type`).toBe(true);
      check(type, template.fields, false, type);
    });
  }

  it("resolves variants to their family's template", () => {
    expect(suggestionFor("BlogPosting", "headline")).toEqual(templates.Article!.fields.headline);
  });

  it("builds a new rule that emits the family's first variant", () => {
    const rule = ruleFromTemplate("Article");
    expect(rule.key).toBeUndefined();
    expect(rule.definition["@type"]).toBe("Article");
    expect(rule.scope).toBe("documentTypes");
    expect(Object.keys(rule.definition.fields)).toContain("headline");
  });

  it("offers a template for every starter type", () => {
    for (const type of STARTER_TYPES) expect(templates[type], type).toBeDefined();
  });

  it("gives every template a site-appropriate scope", () => {
    const siteWide: Binding["source"][] = ["name", "url", "createDate", "updateDate"];
    for (const [type, template] of Object.entries(templates)) {
      // A site-wide rule reading page-specific sources would emit page data as if it were site data.
      if (template.scope === "site" && type !== "WebPage" && type !== "BreadcrumbList") {
        for (const binding of Object.values(template.fields)) {
          expect(siteWide, `${type} is site-wide but binds ${binding.source}`).not.toContain(binding.source);
        }
      }
    }
  });
});
