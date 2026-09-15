import { css, customElement, html, nothing, property, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import type { UUITextareaElement, UUIToggleElement } from "@umbraco-cms/backoffice/external/uui";
import { getDefinition } from "../catalogue/index.js";
import { assess, summarize, type Completeness } from "../completeness.js";
import { CUSTOM_TYPE_ALIAS } from "../constants.js";
import { KobenValueChangeEvent } from "../events.js";
import { isJsonObject, type JsonObject, type StructuredDataItem } from "../model.js";
import type { KobenReferenceLookup } from "../reference-lookup.js";
import "./entity-form.element.js";

export class KobenEntryActionEvent extends Event {
  constructor(public readonly action: "duplicate" | "remove") {
    super("koben-entry-action", { bubbles: false, composed: false });
  }
}

const TAG_LOOK: Record<Completeness["level"], { color: "positive" | "warning" | "danger" | "default"; text: string }> = {
  ready: { color: "positive", text: "Ready" },
  recommended: { color: "warning", text: "Could be richer" },
  incomplete: { color: "danger", text: "Incomplete" },
  invalid: { color: "danger", text: "Invalid" },
  disabled: { color: "default", text: "Disabled" },
};

/**
 * One authored entity: a header that reads at a glance (type, summary, completeness, on/off) over
 * a collapsible body holding the catalogue form or, for the escape hatch, raw JSON-LD.
 */
@customElement("koben-sd-entry-card")
export class KobenStructuredDataEntryCardElement extends UmbLitElement {
  @property({ attribute: false })
  public item!: StructuredDataItem;

  @property({ type: Boolean, reflect: true })
  public readonly = false;

  @property({ type: Boolean, reflect: true })
  public expanded = false;

  @property({ attribute: false })
  public lookup?: KobenReferenceLookup;

  @property({ type: Number })
  public lookupVersion = 0;

  @state()
  private _jsonText?: string;

  @state()
  private _jsonError?: string;

  #emit(item: StructuredDataItem) {
    this.item = item;
    this.dispatchEvent(new KobenValueChangeEvent(item));
  }

  #toggleExpanded() {
    this.expanded = !this.expanded;
  }

  #onEnabled(event: Event) {
    event.stopPropagation();
    this.#emit({ ...this.item, enabled: (event.target as UUIToggleElement).checked });
  }

  #onJsonInput(event: Event) {
    const text = (event.target as UUITextareaElement).value as string;
    this._jsonText = text;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isJsonObject(parsed)) {
        this._jsonError = "The JSON-LD must be a single object.";
        return;
      }
      if (typeof parsed["@type"] !== "string" || !parsed["@type"]) {
        this._jsonError = 'The object needs an "@type".';
      } else {
        this._jsonError = undefined;
      }
      this.#emit({ ...this.item, node: parsed });
    } catch (error) {
      this._jsonError = error instanceof SyntaxError ? `Not valid JSON: ${error.message}` : "Not valid JSON.";
    }
  }

  #formatJson() {
    this._jsonText = JSON.stringify(this.item.node, null, 2);
    this._jsonError = undefined;
  }

  override render() {
    const isCustom = this.item.type === CUSTOM_TYPE_ALIAS;
    const definition = isCustom ? undefined : getDefinition(this.item.type);
    const completeness = assess(this.item);
    const tag = TAG_LOOK[completeness.level];
    const summary = summarize(this.item);
    const label = isCustom ? "Custom JSON-LD" : (definition?.label ?? this.item.type);
    const typeShown = String(this.item.node["@type"] ?? this.item.type);

    return html`
      <div class="card" data-key=${this.item.key}>
        <div class="head" @click=${this.#toggleExpanded}>
          <span class="drag-handle" title="Drag to reorder" @click=${(event: Event) => event.stopPropagation()}>
            <uui-icon name="icon-navigation"></uui-icon>
          </span>
          <umb-icon class="type-icon" name=${definition?.icon ?? "icon-code"}></umb-icon>
          <div class="title">
            <span class="label">${label}${typeShown !== label && typeShown !== this.item.type ? html` <span class="variant">· ${typeShown}</span>` : nothing}</span>
            ${summary ? html`<span class="summary">${summary}</span>` : html`<span class="summary muted">Nothing entered yet</span>`}
          </div>
          <uui-tag color=${tag.color} look="secondary">${tag.text}</uui-tag>
          <uui-toggle
            label="Enabled"
            title=${this.item.enabled ? "Included in the page's structured data" : "Kept, but not emitted"}
            ?checked=${this.item.enabled}
            ?disabled=${this.readonly}
            @click=${(event: Event) => event.stopPropagation()}
            @change=${this.#onEnabled}></uui-toggle>
          <uui-button
            compact
            look="secondary"
            label="Duplicate"
            ?disabled=${this.readonly}
            @click=${(event: Event) => {
              event.stopPropagation();
              this.dispatchEvent(new KobenEntryActionEvent("duplicate"));
            }}>
            <uui-icon name="icon-documents"></uui-icon>
          </uui-button>
          <uui-button
            compact
            look="secondary"
            color="danger"
            label="Remove"
            ?disabled=${this.readonly}
            @click=${(event: Event) => {
              event.stopPropagation();
              this.dispatchEvent(new KobenEntryActionEvent("remove"));
            }}>
            <uui-icon name="icon-trash"></uui-icon>
          </uui-button>
          <uui-button compact look="secondary" label=${this.expanded ? "Collapse" : "Expand"} @click=${(event: Event) => {
            event.stopPropagation();
            this.#toggleExpanded();
          }}>
            <uui-icon name=${this.expanded ? "icon-navigation-up" : "icon-navigation-down"}></uui-icon>
          </uui-button>
        </div>
        ${this.expanded ? this.#renderBody(isCustom, definition, completeness) : nothing}
      </div>
    `;
  }

  #renderBody(isCustom: boolean, definition: ReturnType<typeof getDefinition>, completeness: Completeness) {
    return html`
      <div class="body">
        ${this.#renderHints(completeness, definition)}
        ${isCustom
          ? this.#renderCustom()
          : definition
            ? html`
                <koben-sd-entity-form
                  .definition=${definition}
                  .node=${this.item.node}
                  .lookup=${this.lookup}
                  .lookupVersion=${this.lookupVersion}
                  ?readonly=${this.readonly}
                  @koben-value-change=${(event: KobenValueChangeEvent<JsonObject>) => this.#emit({ ...this.item, node: event.value })}></koben-sd-entity-form>
              `
            : html`<p class="muted">This entry uses a type this version of the editor does not know (<code>${this.item.type}</code>). Its JSON is kept as authored.</p>`}
      </div>
    `;
  }

  #renderHints(completeness: Completeness, definition: ReturnType<typeof getDefinition>) {
    const guidance = definition?.guidance;
    const docsUrl = definition?.docsUrl;
    if (!completeness.missing.length && !completeness.suggested.length && !docsUrl && !guidance) return nothing;
    return html`
      <div class="hints">
        ${guidance
          ? html`
              <p class="hint guidance">
                <uui-icon name="icon-info"></uui-icon>
                <span>${guidance}${docsUrl ? html` <a href=${docsUrl} target="_blank" rel="noopener">Google's guidelines ↗</a>` : nothing}</span>
              </p>
            `
          : docsUrl
            ? html`<p class="hint"><a href=${docsUrl} target="_blank" rel="noopener">Google's guidelines for this type ↗</a></p>`
            : nothing}
        ${completeness.missing.length ? html`<p class="hint danger"><strong>Required:</strong> ${completeness.missing.join(", ")}</p>` : nothing}
        ${completeness.suggested.length ? html`<p class="hint warning"><strong>Recommended:</strong> ${completeness.suggested.join(", ")}</p>` : nothing}
      </div>
    `;
  }

  #renderCustom() {
    const text = this._jsonText ?? JSON.stringify(this.item.node, null, 2);
    return html`
      <umb-property-layout orientation="vertical" label="JSON-LD" description='A single object with an "@type". The "@context" is added for you.'>
        <div slot="editor">
          <uui-textarea class="code" label="JSON-LD" rows="14" .value=${text} ?readonly=${this.readonly} @input=${this.#onJsonInput}></uui-textarea>
          ${this._jsonError ? html`<p class="hint danger">${this._jsonError}</p>` : nothing}
          <uui-button look="outline" compact label="Format" ?disabled=${this.readonly} @click=${this.#formatJson}>Format</uui-button>
        </div>
      </umb-property-layout>
    `;
  }

  static override styles = [
    css`
      :host {
        display: block;
      }

      .card {
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        background: var(--uui-color-surface);
      }

      :host([expanded]) .card {
        border-color: var(--uui-color-border-emphasis);
      }

      .head {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-3);
        padding: var(--uui-size-space-3) var(--uui-size-space-4);
        cursor: pointer;
        user-select: none;
      }

      .head:hover {
        background: var(--uui-color-surface-alt);
      }

      .drag-handle {
        cursor: grab;
        color: var(--uui-color-border-emphasis);
        display: inline-flex;
      }

      .type-icon {
        font-size: 1.4em;
        color: var(--uui-color-text-alt);
      }

      .title {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }

      .label {
        font-weight: 600;
      }

      .variant {
        font-weight: 400;
        color: var(--uui-color-text-alt);
      }

      .summary {
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .muted {
        color: var(--uui-color-text-alt);
      }

      .body {
        border-top: 1px solid var(--uui-color-border);
        padding: var(--uui-size-space-2) var(--uui-size-space-5) var(--uui-size-space-4);
      }

      .hints {
        margin-top: var(--uui-size-space-3);
      }

      .hint {
        margin: 0 0 var(--uui-size-space-2);
        font-size: var(--uui-type-small-size);
      }

      .hint.guidance {
        display: flex;
        gap: var(--uui-size-space-2);
        align-items: flex-start;
        padding: var(--uui-size-space-3) var(--uui-size-space-4);
        margin-bottom: var(--uui-size-space-3);
        background: var(--uui-color-surface-alt);
        border-left: 3px solid var(--uui-color-border-emphasis);
        border-radius: var(--uui-border-radius);
        color: var(--uui-color-text);
        line-height: 1.5;
      }

      .hint.guidance uui-icon {
        flex-shrink: 0;
        margin-top: 2px;
        color: var(--uui-color-text-alt);
      }

      .hint.danger {
        color: var(--uui-color-danger);
      }

      .hint.warning {
        color: var(--uui-color-warning-standalone);
      }

      .code {
        width: 100%;
        font-family: var(--uui-font-monospace, monospace);
      }

      .code + .hint,
      .code + .hint + uui-button {
        margin-top: var(--uui-size-space-2);
      }
    `,
  ];
}

export default KobenStructuredDataEntryCardElement;

declare global {
  interface HTMLElementTagNameMap {
    "koben-sd-entry-card": KobenStructuredDataEntryCardElement;
  }
}
