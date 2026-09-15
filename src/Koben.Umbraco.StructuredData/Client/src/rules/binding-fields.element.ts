import { css, customElement, html, nothing, property, repeat } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import type { UUIInputElement, UUISelectElement, UUIToggleElement } from "@umbraco-cms/backoffice/external/uui";
import { fieldHelp, getDefinition, type Field, type TypeDefinition } from "../catalogue/index.js";
import { KobenValueChangeEvent } from "../events.js";
import type { JsonValue } from "../model.js";
import type { Binding, BindingFields, CultureModel, DocumentTypeModel, RefTarget } from "./rules.types.js";
import { describeBinding, SOURCE_HELP, sourceOptions } from "./sources.js";
import { EXTRA_KEY_HELP, suggestionFor } from "./templates.js";

type AliasOption = { value: string; label: string };

const REF_TARGETS: Array<{ value: RefTarget; label: string }> = [
  { value: "organization", label: "The site's Organisation" },
  { value: "website", label: "The site's Website" },
  { value: "webpage", label: "This page" },
];

/**
 * One row per catalogue field of a type: which source fills it, and that source's settings.
 * Nested entities and lists render this same element recursively.
 */
@customElement("koben-sd-binding-fields")
export class KobenStructuredDataBindingFieldsElement extends UmbLitElement {
  @property({ attribute: false })
  public definition?: TypeDefinition;

  @property({ attribute: false })
  public fields: BindingFields = {};

  @property({ type: Boolean })
  public nested = false;

  /** Document types the rule applies to; drives the property alias suggestions. */
  @property({ attribute: false })
  public documentTypes: DocumentTypeModel[] = [];

  /** Configured languages; more than one turns fixed values into per-language values. */
  @property({ attribute: false })
  public cultures: CultureModel[] = [];

  #emit(fields: BindingFields) {
    this.fields = fields;
    this.dispatchEvent(new KobenValueChangeEvent(fields));
  }

  #set(key: string, binding: Binding | undefined) {
    const next = { ...this.fields };
    if (binding) next[key] = binding;
    else delete next[key];
    this.#emit(next);
  }

  get #catalogueFields(): Field[] {
    if (!this.definition) return [];
    return this.nested && this.definition.nestedFields ? this.definition.nestedFields : this.definition.fields;
  }

  /** Properties grouped by the document types the rule applies to; shared aliases appear once, under "Shared". */
  get #aliasGroups(): Array<{ label: string; options: AliasOption[] }> {
    const counts = new Map<string, number>();
    for (const type of this.documentTypes) {
      for (const prop of type.properties) counts.set(prop.alias, (counts.get(prop.alias) ?? 0) + 1);
    }
    const shared = new Map<string, string>();
    const groups: Array<{ label: string; options: AliasOption[] }> = [];
    for (const type of this.documentTypes) {
      const own: AliasOption[] = [];
      for (const prop of type.properties) {
        if (this.documentTypes.length > 1 && counts.get(prop.alias) === this.documentTypes.length) {
          shared.set(prop.alias, prop.name);
        } else {
          own.push({ value: prop.alias, label: `${prop.name} (${prop.alias})` });
        }
      }
      if (own.length) groups.push({ label: type.name, options: own.sort((a, b) => a.label.localeCompare(b.label)) });
    }
    if (shared.size) {
      groups.unshift({
        label: "Shared by all selected types",
        options: [...shared.entries()].map(([value, name]) => ({ value, label: `${name} (${value})` })).sort((a, b) => a.label.localeCompare(b.label)),
      });
    }
    return groups;
  }

  get #knownAliases(): Set<string> {
    return new Set(this.#aliasGroups.flatMap((group) => group.options.map((option) => option.value)));
  }

  override render() {
    const catalogueFields = this.#catalogueFields;
    // Bindings for properties the catalogue does not list (custom keys) still show, so nothing is hidden.
    const extraKeys = Object.keys(this.fields).filter((key) => !catalogueFields.some((field) => field.key === key));

    return html`
      ${repeat(
        catalogueFields,
        (field) => field.key,
        (field) => this.#renderRow(field.key, field.required ? `${field.label} *` : field.label, field, this.fields[field.key]),
      )}
      ${extraKeys.map((key) => this.#renderRow(key, key, undefined, this.fields[key]))}
      ${this.#renderAddCustom()}
    `;
  }

  #renderAddCustom() {
    return html`
      <div class="add-custom">
        <uui-input id="custom-key" label="Custom property" placeholder="Add a schema.org property not listed…"></uui-input>
        <uui-button
          look="secondary"
          compact
          label="Add property"
          @click=${() => {
            const input = this.shadowRoot?.querySelector<UUIInputElement>("#custom-key");
            const key = String(input?.value ?? "").trim();
            if (!key || this.fields[key]) return;
            this.#set(key, { source: "value", value: "" });
            if (input) input.value = "";
          }}>
          Add
        </uui-button>
      </div>
    `;
  }

  #renderRow(key: string, label: string, field: Field | undefined, binding: Binding | undefined) {
    const source = binding?.source ?? "";
    const options = sourceOptions(field);
    const help = fieldHelp(field);
    const extraHelp = field ? undefined : EXTRA_KEY_HELP[key];
    // Suggestions come from the type's template and only apply to the rule's own (top-level) fields.
    const suggestion = !binding && !this.nested && this.definition ? suggestionFor(this.definition.alias, key) : undefined;
    return html`
      <div class="row ${binding ? "bound" : ""}">
        <div class="row-label">
          <span class="label">${label}</span>
          <span class="key">${key}</span>
          ${help.status || help.description || extraHelp
            ? html`
                <span class="help">
                  ${help.status ? html`<span class="status ${help.status.toLowerCase()}">${help.status}</span> ` : nothing}
                  ${help.description ?? extraHelp ?? ""}
                </span>
              `
            : nothing}
          ${help.example ? html`<span class="help example">Example: ${help.example}</span>` : nothing}
        </div>
        <div class="row-control">
          <div class="row-source">
            <uui-select
              class="source"
              label="Source for ${key}"
              .options=${options.map((option) => ({ name: option.label, value: option.value, selected: option.value === source }))}
              @change=${(event: Event) => this.#changeSource(key, field, (event.target as UUISelectElement).value as string)}></uui-select>
            ${field ? nothing : html`<uui-button compact look="secondary" color="danger" label="Remove" @click=${() => this.#set(key, undefined)}><uui-icon name="icon-trash"></uui-icon></uui-button>`}
          </div>
          ${suggestion
            ? html`
                <div class="suggest">
                  <span>Usually: ${describeBinding(suggestion)}</span>
                  <uui-button compact look="outline" label="Use the usual source for ${key}" @click=${() => this.#set(key, structuredClone(suggestion))}>Use</uui-button>
                </div>
              `
            : nothing}
          ${binding
            ? html`
                <div class="row-body">
                  ${this.#hasSettings(binding) ? html`<p class="source-help">${SOURCE_HELP[binding.source]}</p>` : nothing}
                  ${this.#renderBinding(key, field, binding)}
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  /** Sources with their own settings show their help above the settings; the rest describe themselves inline. */
  #hasSettings(binding: Binding): boolean {
    switch (binding.source) {
      case "property":
      case "value":
      case "dictionary":
      case "ref":
      case "id":
      case "entity":
      case "list":
        return true;
      default:
        return false;
    }
  }

  #changeSource(key: string, field: Field | undefined, source: string) {
    switch (source) {
      case "":
        return this.#set(key, undefined);
      case "property":
        return this.#set(key, { source: "property", alias: "", ...(field?.kind === "image" && field.as === "url" ? { format: "url" as const } : {}) });
      case "value":
        return this.#set(key, { source: "value", value: field?.kind === "boolean" ? true : "" });
      case "dictionary":
        return this.#set(key, { source: "dictionary", key: "" });
      case "ref":
        return this.#set(key, { source: "ref", target: "organization" });
      case "id":
        return this.#set(key, { source: "id", target: "webpage" });
      case "entity": {
        const type = field?.kind === "entity" ? field.types[0] : field?.kind === "list" && field.of.kind === "entity" ? field.of.types[0] : "Thing";
        return this.#set(key, { source: "entity", "@type": type ?? "Thing", fields: {} });
      }
      case "list":
        return this.#set(key, { source: "list", items: [] });
      default:
        return this.#set(key, { source } as Binding);
    }
  }

  #renderBinding(key: string, field: Field | undefined, binding: Binding) {
    switch (binding.source) {
      case "property":
        return this.#renderProperty(key, binding);
      case "value":
        return this.#renderValue(key, field, binding);
      case "dictionary":
        return html`
          <div class="setting">
            <label>Dictionary key</label>
            <uui-input
              label="Dictionary key"
              placeholder="As shown in Translation → Dictionary, for example Site.Name"
              .value=${binding.key}
              @input=${(event: Event) => this.#set(key, { source: "dictionary", key: (event.target as UUIInputElement).value as string })}></uui-input>
          </div>
        `;
      case "ref":
      case "id":
        return html`
          <uui-select
            label="Target"
            .options=${REF_TARGETS.map((target) => ({ name: target.label, value: target.value, selected: target.value === binding.target }))}
            @change=${(event: Event) => this.#set(key, { ...binding, target: (event.target as UUISelectElement).value as RefTarget })}></uui-select>
        `;
      case "entity":
        return this.#renderEntity(field, binding, (next) => this.#set(key, next));
      case "list":
        return this.#renderList(field, binding, (next) => this.#set(key, next));
      default:
        return html`<span class="hint">${this.#describe(binding.source)}</span>`;
    }
  }

  #describe(source: Binding["source"]): string {
    return SOURCE_HELP[source] ?? "";
  }

  #renderProperty(key: string, binding: Extract<Binding, { source: "property" }>) {
    const groups = this.#aliasGroups;
    const known = this.#knownAliases.has(binding.alias);
    const custom = !known;
    const showFormat = true;
    return html`
      <div class="settings">
        <div class="setting">
          <label>Property</label>
          <div class="setting-controls">
            ${groups.length
              ? html`
                  <select
                    class="native"
                    aria-label="Property"
                    @change=${(event: Event) => {
                      const alias = (event.target as HTMLSelectElement).value;
                      this.#set(key, { ...binding, alias: alias === "__custom" ? "" : alias });
                    }}>
                    <option value="" ?selected=${!binding.alias} disabled>Choose a property…</option>
                    ${groups.map(
                      (group) => html`
                        <optgroup label=${group.label}>
                          ${group.options.map((option) => html`<option value=${option.value} ?selected=${option.value === binding.alias}>${option.label}</option>`)}
                        </optgroup>
                      `,
                    )}
                    <option value="__custom" ?selected=${custom && !!binding.alias}>Custom alias or path…</option>
                  </select>
                `
              : nothing}
            ${custom || !groups.length
              ? html`
                  <uui-input
                    label="Alias"
                    placeholder="pageTitle, or author.name to walk into picked content"
                    .value=${binding.alias}
                    @input=${(event: Event) => this.#set(key, { ...binding, alias: (event.target as UUIInputElement).value as string })}></uui-input>
                `
              : nothing}
          </div>
        </div>
        <details class="more" ?open=${!!binding.fallbackAliases?.length || binding.scope === "site" || (!!binding.format && binding.format !== "auto")}>
          <summary>More options</summary>
          <div class="setting">
            <label>Fallbacks</label>
            <uui-input
              label="Fallback aliases"
              placeholder="Comma separated, tried in order when empty"
              .value=${(binding.fallbackAliases ?? []).join(", ")}
              @input=${(event: Event) => {
                const list = String((event.target as UUIInputElement).value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
                const { fallbackAliases: _drop, ...rest } = binding;
                this.#set(key, list.length ? { ...rest, fallbackAliases: list } : rest);
              }}></uui-input>
          </div>
          <div class="setting">
            <label>Read from</label>
            <uui-toggle
              label="Site root instead of this page"
              ?checked=${binding.scope === "site"}
              @change=${(event: Event) => {
                const { scope: _drop, ...rest } = binding;
                this.#set(key, (event.target as UUIToggleElement).checked ? { ...rest, scope: "site" } : rest);
              }}></uui-toggle>
          </div>
          ${showFormat
            ? html`
                <div class="setting">
                  <label>Picked content</label>
                  <uui-select
                    label="Format"
                    .options=${[
                      { name: "URL for pages, ImageObject for media", value: "auto", selected: !binding.format || binding.format === "auto" },
                      { name: "Its name", value: "name", selected: binding.format === "name" },
                      { name: "A bare URL (media too)", value: "url", selected: binding.format === "url" },
                    ]}
                    @change=${(event: Event) => {
                      const format = (event.target as UUISelectElement).value as "auto" | "name" | "url";
                      const { format: _drop, ...rest } = binding;
                      this.#set(key, format === "auto" ? rest : { ...rest, format });
                    }}></uui-select>
                </div>
              `
            : nothing}
        </details>
      </div>
    `;
  }

  #renderValue(key: string, field: Field | undefined, binding: Extract<Binding, { source: "value" }>) {
    const value = binding.value;
    const setValue = (next: JsonValue) => this.#set(key, { ...binding, value: next });
    const isText = !field || field.kind === "text" || field.kind === "textarea" || field.kind === "url" || field.kind === "email" || field.kind === "tel" || field.kind === "duration";
    if (isText && this.cultures.length > 1) {
      return html`
        <div class="settings">
          ${this.cultures.map((culture) => {
            const override = binding.cultureValues?.[culture.isoCode];
            const shown = culture.isDefault ? value : override;
            return html`
              <div class="setting">
                <label>${culture.name}${culture.isDefault ? " (default)" : ""}</label>
                <uui-input
                  label=${culture.name}
                  placeholder=${culture.isDefault ? "" : "Falls back to the default language"}
                  .value=${typeof shown === "string" || typeof shown === "number" ? String(shown) : ""}
                  @input=${(event: Event) => {
                    const text = (event.target as UUIInputElement).value as string;
                    if (culture.isDefault) {
                      setValue(text);
                      return;
                    }
                    const cultureValues = { ...(binding.cultureValues ?? {}) };
                    if (text) cultureValues[culture.isoCode] = text;
                    else delete cultureValues[culture.isoCode];
                    const { cultureValues: _drop, ...rest } = binding;
                    this.#set(key, Object.keys(cultureValues).length ? { ...rest, cultureValues } : rest);
                  }}></uui-input>
              </div>
            `;
          })}
        </div>
      `;
    }
    if (field?.kind === "boolean") {
      return html`<uui-toggle label="Value" ?checked=${value === true} @change=${(event: Event) => setValue((event.target as UUIToggleElement).checked)}></uui-toggle>`;
    }
    if (field?.kind === "select") {
      return html`
        <uui-select
          label="Value"
          .options=${field.options.map((option) => ({ name: option.label, value: option.value, selected: option.value === value }))}
          @change=${(event: Event) => setValue((event.target as UUISelectElement).value as string)}></uui-select>
      `;
    }
    if (field?.kind === "number") {
      return html`<uui-input label="Value" type="number" step="any" .value=${typeof value === "number" ? String(value) : ""} @input=${(event: Event) => {
        const parsed = Number((event.target as UUIInputElement).value);
        setValue(Number.isFinite(parsed) ? parsed : "");
      }}></uui-input>`;
    }
    if (field?.kind === "list") {
      const text = Array.isArray(value) ? value.map((entry) => String(entry)).join("\n") : typeof value === "string" ? value : "";
      return html`<uui-textarea label="Values, one per line" .value=${text} @input=${(event: Event) => {
        const lines = String((event.target as UUIInputElement).value ?? "").split("\n").map((entry) => entry.trim()).filter(Boolean);
        setValue(lines);
      }}></uui-textarea>`;
    }
    return html`<uui-input label="Value" .value=${typeof value === "string" || typeof value === "number" ? String(value) : ""} @input=${(event: Event) => setValue((event.target as UUIInputElement).value as string)}></uui-input>`;
  }

  #renderEntity(field: Field | undefined, binding: Extract<Binding, { source: "entity" }>, onChange: (next: Binding) => void) {
    const types = field?.kind === "entity" ? field.types : field?.kind === "list" && field.of.kind === "entity" ? field.of.types : [];
    const definition = getDefinition(binding["@type"]);
    return html`
      <div class="entity">
        <div class="entity-head">
          ${types.length > 1
            ? html`
                <uui-select
                  label="Entity type"
                  .options=${types.map((type) => ({ name: getDefinition(type)?.label ?? type, value: type, selected: type === binding["@type"] }))}
                  @change=${(event: Event) => onChange({ source: "entity", "@type": (event.target as UUISelectElement).value as string, fields: {} })}></uui-select>
              `
            : html`<uui-input label="Entity type" .value=${binding["@type"]} @input=${(event: Event) => onChange({ ...binding, "@type": (event.target as UUIInputElement).value as string })}></uui-input>`}
        </div>
        <koben-sd-binding-fields
          nested
          .definition=${definition}
          .fields=${binding.fields}
          .documentTypes=${this.documentTypes}
          .cultures=${this.cultures}
          @koben-value-change=${(event: KobenValueChangeEvent<BindingFields>) => onChange({ ...binding, fields: event.value })}></koben-sd-binding-fields>
      </div>
    `;
  }

  #renderList(field: Field | undefined, binding: Extract<Binding, { source: "list" }>, onChange: (next: Binding) => void) {
    const memberTypes = field?.kind === "list" && field.of.kind === "entity" ? field.of.types : ["Thing"];
    const update = (items: Binding[]) => onChange({ source: "list", items });
    return html`
      <div class="list">
        ${binding.items.map(
          (item, index) => html`
            <div class="list-row">
              <div class="list-member">
                ${item.source === "entity"
                  ? this.#renderEntity(field, item, (next) => update(binding.items.map((existing, i) => (i === index ? next : existing))))
                  : html`<span class="hint">${item.source}</span>`}
              </div>
              <uui-button compact look="secondary" color="danger" label="Remove item" @click=${() => update(binding.items.filter((_, i) => i !== index))}>
                <uui-icon name="icon-trash"></uui-icon>
              </uui-button>
            </div>
          `,
        )}
        <uui-button look="outline" compact label="Add item" @click=${() => update([...binding.items, { source: "entity", "@type": memberTypes[0] ?? "Thing", fields: {} }])}>
          <uui-icon name="icon-add"></uui-icon> Add ${getDefinition(memberTypes[0] ?? "")?.label ?? "item"}
        </uui-button>
      </div>
    `;
  }

  static override styles = [
    css`
      :host {
        display: block;
      }

      .row {
        display: grid;
        grid-template-columns: minmax(150px, 220px) 1fr;
        gap: var(--uui-size-space-4);
        align-items: start;
        padding: var(--uui-size-space-3) 0;
        border-bottom: 1px solid var(--uui-color-border);
      }

      .row:last-of-type {
        border-bottom: none;
      }

      .row-label {
        display: flex;
        flex-direction: column;
        padding-top: 6px;
        min-width: 0;
      }

      .label {
        font-weight: 600;
      }

      .key {
        font-family: var(--uui-font-monospace, monospace);
        font-size: 11px;
        color: var(--uui-color-text-alt);
      }

      .help {
        margin-top: var(--uui-size-space-1);
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
        line-height: 1.4;
      }

      .help.example {
        font-style: italic;
      }

      .status {
        font-weight: 600;
      }

      .status.required {
        color: var(--uui-color-danger);
      }

      .status.recommended {
        color: var(--uui-color-warning-standalone);
      }

      .suggest {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-3);
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
      }

      .source-help {
        margin: 0 0 var(--uui-size-space-3);
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
        line-height: 1.4;
      }

      .row-control {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
        min-width: 0;
      }

      .row-source {
        display: flex;
        gap: var(--uui-size-space-2);
        align-items: center;
      }

      .source {
        width: 280px;
        max-width: 100%;
      }

      .row-body {
        padding: var(--uui-size-space-3) var(--uui-size-space-4);
        background: var(--uui-color-surface-alt);
        border-radius: var(--uui-border-radius);
      }

      .settings {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
      }

      .setting {
        display: grid;
        grid-template-columns: 110px 1fr;
        align-items: center;
        gap: var(--uui-size-space-3);
      }

      .setting label {
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
      }

      .setting-controls {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-1);
        min-width: 0;
      }

      .native {
        width: 100%;
        box-sizing: border-box;
        font: inherit;
        padding: 6px 8px;
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        background: var(--uui-color-surface);
        color: inherit;
      }

      .more {
        margin-top: var(--uui-size-space-1);
      }

      .more summary {
        cursor: pointer;
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-interactive);
        margin-bottom: var(--uui-size-space-2);
      }

      .more .setting + .setting {
        margin-top: var(--uui-size-space-2);
      }

      uui-input,
      uui-select,
      uui-textarea {
        width: 100%;
      }

      .hint {
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
      }

      .entity {
        border-left: 3px solid var(--uui-color-border-emphasis);
        padding-left: var(--uui-size-space-4);
      }

      .entity-head {
        margin-bottom: var(--uui-size-space-2);
        max-width: 320px;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-3);
      }

      .list-row {
        display: flex;
        gap: var(--uui-size-space-2);
        align-items: flex-start;
      }

      .list-member {
        flex: 1;
        min-width: 0;
      }

      .add-custom {
        display: flex;
        gap: var(--uui-size-space-2);
        align-items: center;
        padding-top: var(--uui-size-space-3);
      }

      .add-custom uui-input {
        flex: 1;
      }
    `,
  ];
}

export default KobenStructuredDataBindingFieldsElement;

declare global {
  interface HTMLElementTagNameMap {
    "koben-sd-binding-fields": KobenStructuredDataBindingFieldsElement;
  }
}
