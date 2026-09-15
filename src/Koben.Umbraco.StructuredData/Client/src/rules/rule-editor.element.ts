import { css, customElement, html, nothing, property, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import type { UUIInputElement, UUISelectElement, UUITextareaElement, UUIToggleElement, UUICheckboxElement } from "@umbraco-cms/backoffice/external/uui";
import type { UmbInputDocumentElement } from "@umbraco-cms/backoffice/document";
import { getDefinition, groupOrder, topLevelDefinitions } from "../catalogue/index.js";
import { KobenValueChangeEvent } from "../events.js";
import { formatJsonLd } from "../jsonld.js";
import type { JsonObject } from "../model.js";
import { rulesApi, RulesApiError } from "./rules.api.js";
import type { BindingFields, CultureModel, DocumentTypeModel, RuleModel, SiteModel } from "./rules.types.js";
import "./binding-fields.element.js";

export class KobenRuleSavedEvent extends Event {
  constructor(public readonly rule: RuleModel) {
    super("koben-rule-saved", { bubbles: false, composed: false });
  }
}

export class KobenRuleDeletedEvent extends Event {
  constructor(public readonly key: string) {
    super("koben-rule-deleted", { bubbles: false, composed: false });
  }
}

/** Edits one generation rule: scope, type, bindings, and a test panel against a real page. */
@customElement("koben-sd-rule-editor")
export class KobenStructuredDataRuleEditorElement extends UmbLitElement {
  @property({ attribute: false })
  public set rule(value: RuleModel) {
    this._draft = structuredClone(value);
    this._dirty = false;
    this._message = undefined;
    this._testNodes = undefined;
  }

  public get rule(): RuleModel {
    return this._draft;
  }

  @property({ attribute: false })
  public documentTypes: DocumentTypeModel[] = [];

  @property({ attribute: false })
  public sites: SiteModel[] = [];

  @property({ attribute: false })
  public cultures: CultureModel[] = [];

  @state()
  private _draft: RuleModel = { name: "", enabled: true, sortOrder: 0, scope: "site", documentTypeAliases: [], sites: [], cultures: [], definition: { "@type": "WebPage", fields: {} } };

  @state()
  private _dirty = false;

  @state()
  private _saving = false;

  @state()
  private _message?: { text: string; color: "positive" | "danger" };

  @state()
  private _advanced = false;

  @state()
  private _advancedError?: string;

  @state()
  private _testDocumentId = "";

  @state()
  private _testCulture = "";

  @state()
  private _testNodes?: JsonObject[];

  @state()
  private _testError?: string;

  #update(patch: Partial<RuleModel>) {
    this._draft = { ...this._draft, ...patch };
    this._dirty = true;
    this._message = undefined;
  }

  #updateDefinition(patch: Partial<RuleModel["definition"]>) {
    this.#update({ definition: { ...this._draft.definition, ...patch } });
  }

  get #selectedDocumentTypes(): DocumentTypeModel[] {
    if (this._draft.scope === "site") return this.documentTypes;
    return this.documentTypes.filter((type) => this._draft.documentTypeAliases.includes(type.alias));
  }

  get #definitionForType() {
    return getDefinition(this._draft.definition["@type"]);
  }

  async #save() {
    if (!this._draft.name.trim()) {
      this._message = { text: "Give the rule a name.", color: "danger" };
      return;
    }
    this._saving = true;
    try {
      const saved = this._draft.key ? await rulesApi.update(this._draft.key, this._draft) : await rulesApi.create(this._draft);
      this._draft = structuredClone(saved);
      this._dirty = false;
      this._message = { text: "Saved.", color: "positive" };
      this.dispatchEvent(new KobenRuleSavedEvent(saved));
    } catch (error) {
      this._message = { text: error instanceof RulesApiError ? error.message : "The rule could not be saved.", color: "danger" };
    } finally {
      this._saving = false;
    }
  }

  async #delete() {
    if (!this._draft.key) return;
    if (!confirm(`Delete the rule "${this._draft.name}"? Pages will stop emitting what it generated.`)) return;
    try {
      await rulesApi.remove(this._draft.key);
      this.dispatchEvent(new KobenRuleDeletedEvent(this._draft.key));
    } catch (error) {
      this._message = { text: error instanceof RulesApiError ? error.message : "The rule could not be deleted.", color: "danger" };
    }
  }

  async #test() {
    if (!this._testDocumentId) return;
    this._testError = undefined;
    this._testNodes = undefined;
    try {
      const result = await rulesApi.preview(this._draft, this._testDocumentId, this._testCulture || undefined);
      this._testNodes = result.nodes;
    } catch (error) {
      this._testError = error instanceof RulesApiError ? error.message : "The preview failed.";
    }
  }

  #applyAdvanced(event: Event) {
    const text = (event.target as UUITextareaElement).value as string;
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || typeof (parsed as { "@type"?: unknown })["@type"] !== "string") {
        this._advancedError = 'The definition must be an object with an "@type".';
        return;
      }
      const definition = parsed as RuleModel["definition"];
      this._advancedError = undefined;
      this.#update({ definition: { "@type": definition["@type"], fields: definition.fields ?? {} } });
    } catch (error) {
      this._advancedError = error instanceof SyntaxError ? `Not valid JSON: ${error.message}` : "Not valid JSON.";
    }
  }

  override render() {
    const definition = this.#definitionForType;
    return html`
      <div class="editor">
        ${this.#renderHeader()}
        ${this.#renderScope()}
        ${this.#renderType()}
        <umb-property-layout orientation="vertical" label="Fields" description="Where each schema.org property gets its value. Empty results are dropped when the page renders.">
          <div slot="editor">
            ${this._advanced
              ? html`
                  <uui-textarea
                    class="code"
                    label="Definition JSON"
                    rows="18"
                    .value=${JSON.stringify(this._draft.definition, null, 2)}
                    @change=${this.#applyAdvanced}></uui-textarea>
                  ${this._advancedError ? html`<p class="error">${this._advancedError}</p>` : nothing}
                `
              : html`
                  <koben-sd-binding-fields
                    .definition=${definition}
                    .fields=${this._draft.definition.fields}
                    .documentTypes=${this.#selectedDocumentTypes}
                    .cultures=${this.cultures}
                    @koben-value-change=${(event: KobenValueChangeEvent<BindingFields>) => this.#updateDefinition({ fields: event.value })}></koben-sd-binding-fields>
                `}
            <uui-button look="secondary" compact label=${this._advanced ? "Back to the form" : "Edit as JSON"} @click=${() => (this._advanced = !this._advanced)}>
              ${this._advanced ? "Back to the form" : "Edit as JSON"}
            </uui-button>
          </div>
        </umb-property-layout>
        ${this.#renderTest()}
        <div class="actions">
          <uui-button look="primary" color="positive" label="Save" ?disabled=${this._saving} @click=${this.#save}>${this._draft.key ? "Save" : "Create"}</uui-button>
          ${this._draft.key ? html`<uui-button look="secondary" color="danger" label="Delete" @click=${this.#delete}>Delete</uui-button>` : nothing}
          ${this._dirty ? html`<span class="hint">Unsaved changes</span>` : nothing}
          ${this._message ? html`<uui-tag color=${this._message.color} look="secondary">${this._message.text}</uui-tag>` : nothing}
        </div>
      </div>
    `;
  }

  #renderHeader() {
    return html`
      <div class="header">
        <uui-input class="name" label="Rule name" placeholder="Rule name" .value=${this._draft.name} @input=${(event: Event) => this.#update({ name: (event.target as UUIInputElement).value as string })}></uui-input>
        <uui-toggle label="Enabled" ?checked=${this._draft.enabled} @change=${(event: Event) => this.#update({ enabled: (event.target as UUIToggleElement).checked })}></uui-toggle>
        <label class="order" title="Evaluation order. Lower runs first; when two rules emit the same type on a page, the later one wins.">
          <span>Order</span>
          <uui-input label="Order" type="number" .value=${String(this._draft.sortOrder)} @input=${(event: Event) => this.#update({ sortOrder: Number((event.target as UUIInputElement).value) || 0 })}></uui-input>
        </label>
      </div>
    `;
  }

  #renderScope() {
    return html`
      <umb-property-layout orientation="vertical" label="Applies to" description="Site-wide rules run on every page. Later rules of the same type override earlier ones, and anything an editor authors on a page overrides both.">
        <div slot="editor">
          <uui-radio-group
            .value=${this._draft.scope}
            @change=${(event: Event) => this.#update({ scope: (event.target as HTMLInputElement).value as RuleModel["scope"] })}>
            <uui-radio value="site" label="All pages">All pages</uui-radio>
            <uui-radio value="documentTypes" label="Specific document types">Specific document types</uui-radio>
          </uui-radio-group>
          ${this.#renderTargeting()}
          ${this._draft.scope === "documentTypes"
            ? html`
                <div class="doctypes">
                  ${this.documentTypes.map(
                    (type) => html`
                      <uui-checkbox
                        label=${type.name}
                        ?checked=${this._draft.documentTypeAliases.includes(type.alias)}
                        @change=${(event: Event) => {
                          const checked = (event.target as UUICheckboxElement).checked;
                          const aliases = this._draft.documentTypeAliases.filter((alias) => alias !== type.alias);
                          this.#update({ documentTypeAliases: checked ? [...aliases, type.alias] : aliases });
                        }}>
                        ${type.name} <span class="alias">${type.alias}</span>
                      </uui-checkbox>
                    `,
                  )}
                </div>
              `
            : nothing}
        </div>
      </umb-property-layout>
    `;
  }

  /** Site and language filters; hidden when the install has only one of each, since there is nothing to choose. */
  #renderTargeting() {
    const showSites = this.sites.length > 1;
    const showCultures = this.cultures.length > 1;
    if (!showSites && !showCultures) return nothing;
    const selectedSites = new Set((this._draft.sites ?? []).map((site) => site.key));
    const selectedCultures = new Set((this._draft.cultures ?? []).map((culture) => culture.toLowerCase()));
    return html`
      <div class="targeting">
        ${showSites
          ? html`
              <div class="target-group">
                <span class="target-label">Sites <span class="muted">(none ticked = every site)</span></span>
                <div class="doctypes">
                  ${this.sites.map(
                    (site) => html`
                      <uui-checkbox
                        label=${site.name}
                        ?checked=${selectedSites.has(site.key)}
                        @change=${(event: Event) => {
                          const checked = (event.target as UUICheckboxElement).checked;
                          const others = (this._draft.sites ?? []).filter((entry) => entry.key !== site.key);
                          this.#update({ sites: checked ? [...others, { key: site.key, name: site.name }] : others });
                        }}>
                        ${site.name}
                        ${site.domains.length ? html`<span class="alias">${site.domains.map((domain) => domain.domainName).join(", ")}</span>` : nothing}
                      </uui-checkbox>
                    `,
                  )}
                </div>
              </div>
            `
          : nothing}
        ${showCultures
          ? html`
              <div class="target-group">
                <span class="target-label">Languages <span class="muted">(none ticked = every language)</span></span>
                <div class="doctypes">
                  ${this.cultures.map(
                    (culture) => html`
                      <uui-checkbox
                        label=${culture.name}
                        ?checked=${selectedCultures.has(culture.isoCode.toLowerCase())}
                        @change=${(event: Event) => {
                          const checked = (event.target as UUICheckboxElement).checked;
                          const others = (this._draft.cultures ?? []).filter((entry) => entry.toLowerCase() !== culture.isoCode.toLowerCase());
                          this.#update({ cultures: checked ? [...others, culture.isoCode] : others });
                        }}>
                        ${culture.name} <span class="alias">${culture.isoCode}${culture.isDefault ? " · default" : ""}</span>
                      </uui-checkbox>
                    `,
                  )}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  #renderType() {
    const current = this._draft.definition["@type"];
    const family = getDefinition(current);
    const groups = groupOrder
      .map((group) => ({ group, items: topLevelDefinitions().filter((definition) => definition.group === group) }))
      .filter((entry) => entry.items.length);
    const known = topLevelDefinitions().some((definition) => definition.alias === current || definition.typeVariants?.some((variant) => variant.value === current));

    return html`
      <umb-property-layout orientation="vertical" label="Schema type" description="The entity this rule generates.">
        <div slot="editor" class="type">
          <select
            class="native"
            aria-label="Schema type"
            @change=${(event: Event) => {
              const alias = (event.target as HTMLSelectElement).value;
              if (!alias) return;
              const definition = getDefinition(alias);
              const type = definition?.typeVariants?.[0]?.value ?? alias;
              this.#update({ definition: { "@type": type, fields: {} } });
            }}>
            <option value="" ?selected=${!known}>Custom type…</option>
            ${groups.map(
              (entry) => html`
                <optgroup label=${entry.group}>
                  ${entry.items.map((definition) => html`<option value=${definition.alias} ?selected=${family?.alias === definition.alias}>${definition.label}</option>`)}
                </optgroup>
              `,
            )}
          </select>
          ${family?.typeVariants?.length
            ? html`
                <uui-select
                  label="Variant"
                  .options=${family.typeVariants.map((variant) => ({ name: variant.label, value: variant.value, selected: variant.value === current }))}
                  @change=${(event: Event) => this.#updateDefinition({ "@type": (event.target as UUISelectElement).value as string })}></uui-select>
              `
            : nothing}
          ${!known
            ? html`<uui-input label="Custom @type" placeholder="schema.org type name" .value=${current} @input=${(event: Event) => this.#updateDefinition({ "@type": (event.target as UUIInputElement).value as string })}></uui-input>`
            : nothing}
        </div>
      </umb-property-layout>
    `;
  }

  #renderTest() {
    return html`
      <umb-property-layout orientation="vertical" label="Test on a page" description="Pick a page and see what this rule (as currently edited) generates for it.">
        <div slot="editor" class="test">
          <umb-input-document .max=${1} .value=${this._testDocumentId} @change=${(event: Event) => (this._testDocumentId = (event.target as UmbInputDocumentElement).selection[0] ?? "")}></umb-input-document>
          <div class="test-actions">
            ${this.cultures.length > 1
              ? html`
                  <uui-select
                    label="Language"
                    .options=${[{ name: "Default language", value: "", selected: !this._testCulture }, ...this.cultures.map((culture) => ({ name: `${culture.name} (${culture.isoCode})`, value: culture.isoCode, selected: culture.isoCode === this._testCulture }))]}
                    @change=${(event: Event) => (this._testCulture = (event.target as UUISelectElement).value as string)}></uui-select>
                `
              : nothing}
            <uui-button look="secondary" compact label="Generate" ?disabled=${!this._testDocumentId} @click=${this.#test}>Generate</uui-button>
          </div>
          ${this._testError ? html`<p class="error">${this._testError}</p>` : nothing}
          ${this._testNodes
            ? html`<pre>${this._testNodes.length ? formatJsonLd(this._testNodes) : "The rule produced nothing for this page (every bound value was empty)."}</pre>`
            : nothing}
        </div>
      </umb-property-layout>
    `;
  }

  static override styles = [
    css`
      :host {
        display: block;
      }

      .editor {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
      }

      .header {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-4);
      }

      .name {
        flex: 1;
        font-size: 1.1em;
      }

      .order {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-2);
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
      }

      .order uui-input {
        width: 5em;
      }

      umb-property-layout {
        padding: var(--uui-size-space-3) 0;
      }

      .targeting {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-3);
        margin-top: var(--uui-size-space-3);
      }

      .target-label {
        display: block;
        font-weight: 600;
        margin-bottom: var(--uui-size-space-1);
      }

      .muted {
        font-weight: 400;
        color: var(--uui-color-text-alt);
        font-size: var(--uui-type-small-size);
      }

      .test-actions {
        display: flex;
        gap: var(--uui-size-space-2);
        align-items: center;
      }

      .test-actions uui-select {
        width: 260px;
      }

      .doctypes {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--uui-size-space-1) var(--uui-size-space-4);
        margin-top: var(--uui-size-space-3);
      }

      .alias {
        color: var(--uui-color-text-alt);
        font-size: var(--uui-type-small-size);
      }

      .type {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
      }

      .native {
        font: inherit;
        padding: 6px 8px;
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        background: var(--uui-color-surface);
        color: inherit;
      }

      uui-select,
      uui-input.name,
      .code {
        width: 100%;
      }

      .code {
        font-family: var(--uui-font-monospace, monospace);
      }

      .test {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
        align-items: flex-start;
      }

      pre {
        width: 100%;
        box-sizing: border-box;
        margin: 0;
        max-height: 360px;
        overflow: auto;
        font-size: 12px;
        background: var(--uui-color-surface-alt);
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        padding: var(--uui-size-space-3);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-3);
        padding-top: var(--uui-size-space-3);
        border-top: 1px solid var(--uui-color-border);
      }

      .hint,
      .error {
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
        margin: 0;
      }

      .error {
        color: var(--uui-color-danger);
      }
    `,
  ];
}

export default KobenStructuredDataRuleEditorElement;

declare global {
  interface HTMLElementTagNameMap {
    "koben-sd-rule-editor": KobenStructuredDataRuleEditorElement;
  }
}
