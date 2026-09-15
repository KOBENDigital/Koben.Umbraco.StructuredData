import { css, customElement, html, nothing, repeat, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { getDefinition } from "../catalogue/index.js";
import { rulesApi, RulesApiError } from "./rules.api.js";
import { newRule, type CultureModel, type DocumentTypeModel, type RuleModel, type SiteModel } from "./rules.types.js";
import { ruleFromTemplate, STARTER_TYPES, templates } from "./templates.js";
import type { KobenRuleDeletedEvent, KobenRuleSavedEvent } from "./rule-editor.element.js";
import "./rule-editor.element.js";

/**
 * The rules manager: every generation rule down the left, the selected one edited on the right,
 * plus export and import for moving rules between environments.
 */
@customElement("koben-sd-rules-view")
export class KobenStructuredDataRulesViewElement extends UmbLitElement {
  @state()
  private _rules: RuleModel[] = [];

  @state()
  private _documentTypes: DocumentTypeModel[] = [];

  @state()
  private _sites: SiteModel[] = [];

  @state()
  private _cultures: CultureModel[] = [];

  @state()
  private _selected?: RuleModel;

  @state()
  private _loading = true;

  @state()
  private _error?: string;

  @state()
  private _notice?: string;

  override connectedCallback() {
    super.connectedCallback();
    void this.#load();
  }

  async #load() {
    this._loading = true;
    this._error = undefined;
    try {
      const [rules, documentTypes, sites, cultures] = await Promise.all([rulesApi.list(), rulesApi.documentTypes(), rulesApi.sites(), rulesApi.cultures()]);
      this._rules = rules;
      this._documentTypes = documentTypes;
      this._sites = sites;
      this._cultures = cultures;
      if (this._selected?.key) {
        this._selected = rules.find((rule) => rule.key === this._selected?.key) ?? undefined;
      }
    } catch (error) {
      this._error = error instanceof RulesApiError ? error.message : "The rules could not be loaded.";
    } finally {
      this._loading = false;
    }
  }

  #create() {
    this._selected = newRule();
  }

  #createFromTemplate(type: string) {
    this._selected = ruleFromTemplate(type);
  }

  /** Starter types the site does not have a rule for yet, so the landing panel only suggests what is missing. */
  get #missingStarters(): string[] {
    const present = new Set(this._rules.map((rule) => getDefinition(rule.definition["@type"])?.alias ?? rule.definition["@type"]));
    return STARTER_TYPES.filter((type) => !present.has(type));
  }

  #onSaved(event: KobenRuleSavedEvent) {
    const saved = event.rule;
    const exists = this._rules.some((rule) => rule.key === saved.key);
    this._rules = exists ? this._rules.map((rule) => (rule.key === saved.key ? saved : rule)) : [...this._rules, saved];
    this._rules = [...this._rules].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    this._selected = saved;
  }

  #onDeleted(event: KobenRuleDeletedEvent) {
    this._rules = this._rules.filter((rule) => rule.key !== event.key);
    this._selected = undefined;
  }

  async #export() {
    try {
      const data = await rulesApi.exportAll();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      this._notice = "Export copied to the clipboard. Paste it into a seed file or another environment's import.";
    } catch (error) {
      this._notice = error instanceof RulesApiError ? error.message : "The export could not be copied; the clipboard may be blocked.";
    }
  }

  async #import(replace: boolean) {
    const text = prompt(replace ? "Paste an export to REPLACE every rule:" : "Paste an export to add or update rules by key:");
    if (!text) return;
    try {
      const parsed = JSON.parse(text) as { version?: number; rules?: RuleModel[] };
      await rulesApi.importAll({ version: parsed.version ?? 1, rules: parsed.rules ?? [], replace });
      this._notice = "Imported.";
      await this.#load();
    } catch (error) {
      this._notice = error instanceof RulesApiError ? error.message : "That is not a valid export.";
    }
  }

  override render() {
    return html`
      <div class="layout">
        <aside>
          <div class="toolbar">
            <uui-button look="primary" label="New rule" @click=${this.#create}><uui-icon name="icon-add"></uui-icon> New rule</uui-button>
          </div>
          ${this._loading ? html`<uui-loader-bar></uui-loader-bar>` : nothing}
          ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
          <div class="list">
            ${repeat(
              this._rules,
              (rule) => rule.key ?? rule.name,
              (rule) => {
                const definition = getDefinition(rule.definition["@type"]);
                const active = this._selected?.key === rule.key;
                return html`
                  <button class="item ${active ? "active" : ""} ${rule.enabled ? "" : "disabled"}" type="button" @click=${() => (this._selected = rule)}>
                    <umb-icon name=${definition?.icon ?? "icon-code"}></umb-icon>
                    <span class="item-text">
                      <span class="item-name">${rule.name || "(unnamed)"}</span>
                      <span class="item-meta">${rule.definition["@type"]} · ${rule.scope === "site" ? "all pages" : rule.documentTypeAliases.join(", ") || "no document types"}${rule.sites?.length ? ` · ${rule.sites.map((site) => site.name ?? site.key).join(", ")}` : ""}${rule.cultures?.length ? ` · ${rule.cultures.join(", ")}` : ""}${rule.enabled ? "" : " · disabled"}</span>
                    </span>
                  </button>
                `;
              },
            )}
            ${!this._loading && !this._rules.length ? html`<p class="empty">No rules yet. Rules generate schema.org entities from page fields so editors do not have to.</p>` : nothing}
          </div>
          <div class="transfer">
            <uui-button look="secondary" compact label="Copy export" @click=${this.#export}>Copy export</uui-button>
            <uui-button look="secondary" compact label="Import (merge)" @click=${() => this.#import(false)}>Import</uui-button>
            <uui-button look="secondary" compact color="danger" label="Import (replace all)" @click=${() => this.#import(true)}>Replace all</uui-button>
          </div>
          ${this._notice ? html`<p class="notice">${this._notice}</p>` : nothing}
        </aside>
        <section>
          ${this._selected
            ? html`
                <uui-box>
                  <koben-sd-rule-editor
                    .rule=${this._selected}
                    .documentTypes=${this._documentTypes}
                    .sites=${this._sites}
                    .cultures=${this._cultures}
                    @koben-rule-saved=${this.#onSaved}
                    @koben-rule-deleted=${this.#onDeleted}></koben-sd-rule-editor>
                </uui-box>
              `
            : html`
                <uui-box headline="Structured data generation">
                  <p>Rules build schema.org JSON-LD from each page's own fields at request time, so editors only author the exceptions. Use site-wide rules for the Organisation, Website and Web page, and document type rules for Articles, People, Services and so on.</p>
                  <p>Precedence on a page: site-wide rules, then document type rules, then anything an editor authored on the site root, then the page's own entries. A later node replaces an earlier one of the same type, so editors can always override a rule for one page.</p>
                  ${this.#missingStarters.length
                    ? html`
                        <h4>Start with the usual rules</h4>
                        <p class="muted">Each one opens prefilled with the recommended bindings; pick your own properties where asked, remove what the site does not have, test on a page, then save.</p>
                        <div class="starters">
                          ${this.#missingStarters.map((type) => {
                            const definition = getDefinition(type);
                            const template = templates[type];
                            return html`
                              <button class="starter" type="button" @click=${() => this.#createFromTemplate(type)}>
                                <umb-icon name=${definition?.icon ?? "icon-code"}></umb-icon>
                                <span class="starter-text">
                                  <span class="starter-name">${template?.name ?? type}</span>
                                  <span class="starter-meta">${template?.scope === "site" ? "Every page" : "Chosen document types"} · ${definition?.description ?? ""}</span>
                                </span>
                              </button>
                            `;
                          })}
                        </div>
                      `
                    : nothing}
                  <p>Select a rule on the left, or create one from scratch.</p>
                </uui-box>
              `}
        </section>
      </div>
    `;
  }

  static override styles = [
    UmbTextStyles,
    css`
      :host {
        display: block;
        padding: var(--uui-size-layout-1);
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(260px, 320px) 1fr;
        gap: var(--uui-size-layout-1);
        align-items: start;
      }

      aside {
        position: sticky;
        top: var(--uui-size-layout-1);
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-3);
      }

      .toolbar uui-button {
        width: 100%;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-1);
      }

      .item {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-3);
        width: 100%;
        text-align: left;
        padding: var(--uui-size-space-3);
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        background: var(--uui-color-surface);
        font: inherit;
        color: inherit;
        cursor: pointer;
      }

      .item:hover {
        background: var(--uui-color-surface-alt);
      }

      .item.active {
        border-color: var(--uui-color-interactive-emphasis);
        background: var(--uui-color-surface-alt);
      }

      .item.disabled .item-name {
        color: var(--uui-color-text-alt);
        text-decoration: line-through;
      }

      .item-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .item-name {
        font-weight: 600;
      }

      .item-meta {
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .transfer {
        display: flex;
        flex-wrap: wrap;
        gap: var(--uui-size-space-2);
        padding-top: var(--uui-size-space-3);
        border-top: 1px solid var(--uui-color-border);
      }

      .starters {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--uui-size-space-3);
        margin: var(--uui-size-space-3) 0 var(--uui-size-space-5);
      }

      .starter {
        display: flex;
        align-items: flex-start;
        gap: var(--uui-size-space-3);
        text-align: left;
        padding: var(--uui-size-space-3) var(--uui-size-space-4);
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        background: var(--uui-color-surface);
        font: inherit;
        color: inherit;
        cursor: pointer;
      }

      .starter:hover {
        border-color: var(--uui-color-interactive-emphasis);
        background: var(--uui-color-surface-alt);
      }

      .starter umb-icon {
        font-size: 1.3em;
        margin-top: 2px;
        color: var(--uui-color-text-alt);
      }

      .starter-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .starter-name {
        font-weight: 600;
      }

      .starter-meta {
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
      }

      .muted {
        color: var(--uui-color-text-alt);
      }

      .empty,
      .notice,
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

export default KobenStructuredDataRulesViewElement;
export { KobenStructuredDataRulesViewElement as element };
