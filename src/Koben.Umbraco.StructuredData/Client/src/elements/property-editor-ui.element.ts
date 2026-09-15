import { css, customElement, html, nothing, property, repeat, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbChangeEvent } from "@umbraco-cms/backoffice/event";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UMB_MODAL_MANAGER_CONTEXT, umbConfirmModal } from "@umbraco-cms/backoffice/modal";
import type { UmbPropertyEditorConfigCollection, UmbPropertyEditorUiElement } from "@umbraco-cms/backoffice/property-editor";
import { UmbSorterController } from "@umbraco-cms/backoffice/sorter";
import { getDefinition } from "../catalogue/index.js";
import { CONFIG, CUSTOM_TYPE_ALIAS } from "../constants.js";
import type { KobenValueChangeEvent } from "../events.js";
import { formatJsonLd, toJsonLd } from "../jsonld.js";
import {
  createItem,
  duplicateItem,
  emptyValue,
  insertItem,
  normalizeValue,
  removeItem,
  replaceItem,
  type JsonObject,
  type StructuredDataItem,
  type StructuredDataValue,
} from "../model.js";
import { KobenReferenceLookup } from "../reference-lookup.js";
import type { KobenEntryActionEvent } from "./entry-card.element.js";
import "./entry-card.element.js";
import { KOBEN_TYPE_PICKER_MODAL } from "./type-picker-modal.token.js";

const VALIDATOR_URL = "https://validator.schema.org/";

/**
 * The Structured Data property editor: an ordered list of authored entities over a live JSON-LD
 * preview. The stored value is the authoring document; the server resolves it on publish.
 */
@customElement("koben-sd-property-editor-ui")
export class KobenStructuredDataPropertyEditorUiElement extends UmbLitElement implements UmbPropertyEditorUiElement {
  #value: StructuredDataValue = emptyValue();

  @property({ attribute: false })
  public set value(raw: unknown) {
    this.#value = normalizeValue(raw);
    void this.#warmLookup();
  }

  public get value(): StructuredDataValue | undefined {
    return this.#value.items.length ? this.#value : undefined;
  }

  @property({ type: Boolean, reflect: true })
  public readonly = false;

  @property({ attribute: false })
  public set config(config: UmbPropertyEditorConfigCollection | undefined) {
    if (!config) return;
    const allowed = config.getValueByAlias<unknown>(CONFIG.allowedTypes);
    this._allowedTypes = Array.isArray(allowed) ? allowed.filter((entry): entry is string => typeof entry === "string") : [];
    const max = Number(config.getValueByAlias(CONFIG.maxItems));
    this._maxItems = Number.isFinite(max) && max > 0 ? max : undefined;
    this._allowCustomJson = config.getValueByAlias<boolean>(CONFIG.allowCustomJson) !== false;
    this._showPreview = config.getValueByAlias<boolean>(CONFIG.showPreview) !== false;
  }

  @state()
  private _allowedTypes: string[] = [];

  @state()
  private _maxItems?: number;

  @state()
  private _allowCustomJson = true;

  @state()
  private _showPreview = true;

  @state()
  private _previewOpen = false;

  @state()
  private _expanded = new Set<string>();

  @state()
  private _lookupVersion = 0;

  @state()
  private _copied = false;

  #modalManager?: typeof UMB_MODAL_MANAGER_CONTEXT.TYPE;
  #lookup = new KobenReferenceLookup(this);

  #sorter = new UmbSorterController<StructuredDataItem, HTMLElement>(this, {
    itemSelector: "koben-sd-entry-card",
    containerSelector: "#cards",
    handleSelector: ".drag-handle",
    getUniqueOfElement: (element) => element.getAttribute("data-key"),
    getUniqueOfModel: (item) => item.key,
    onChange: ({ model }) => this.#commit({ ...this.#value, items: model }),
  });

  constructor() {
    super();
    this.consumeContext(UMB_MODAL_MANAGER_CONTEXT, (manager) => {
      this.#modalManager = manager;
    });
  }

  protected override willUpdate() {
    this.#sorter.setModel(this.#value.items);
    if (this.readonly) this.#sorter.disable();
    else this.#sorter.enable();
  }

  async #warmLookup() {
    await this.#lookup.warm(this.#value);
    this._lookupVersion += 1;
  }

  #commit(value: StructuredDataValue) {
    this.#value = value;
    void this.#warmLookup();
    this.requestUpdate();
    this.dispatchEvent(new UmbChangeEvent());
  }

  async #add() {
    const manager = this.#modalManager;
    if (!manager || this.readonly) return;

    const modal = manager.open(this, KOBEN_TYPE_PICKER_MODAL, {
      data: { allowedTypes: this._allowedTypes, allowCustomJson: this._allowCustomJson },
    });

    let picked;
    try {
      picked = await modal.onSubmit();
    } catch {
      return;
    }
    if (!picked?.type) return;

    const item = this.#newItem(picked.type);
    this._expanded = new Set([...this._expanded, item.key]);
    this.#commit(insertItem(this.#value, item));
  }

  #newItem(type: string): StructuredDataItem {
    if (type === CUSTOM_TYPE_ALIAS) {
      return createItem(CUSTOM_TYPE_ALIAS, { "@type": "" });
    }
    const definition = getDefinition(type);
    const node: JsonObject = { "@type": definition?.typeVariants?.[0]?.value ?? type, ...(definition?.defaults ? structuredClone(definition.defaults) : {}) };
    return createItem(type, node);
  }

  async #onAction(item: StructuredDataItem, event: KobenEntryActionEvent) {
    if (event.action === "duplicate") {
      const index = this.#value.items.findIndex((existing) => existing.key === item.key);
      const copy = duplicateItem(item);
      this._expanded = new Set([...this._expanded, copy.key]);
      this.#commit(insertItem(this.#value, copy, index + 1));
      return;
    }

    try {
      await umbConfirmModal(this, {
        headline: "Remove structured data?",
        content: "The entry and everything entered in it will be removed from this document when you save.",
        confirmLabel: "Remove",
        color: "danger",
      });
    } catch {
      return;
    }
    this.#commit(removeItem(this.#value, item.key));
  }

  #onItemChange(event: KobenValueChangeEvent<StructuredDataItem>) {
    this.#commit(replaceItem(this.#value, event.value));
  }

  #toggleExpanded(key: string, expanded: boolean) {
    const next = new Set(this._expanded);
    if (expanded) next.add(key);
    else next.delete(key);
    this._expanded = next;
  }

  async #copyPreview() {
    try {
      await navigator.clipboard.writeText(formatJsonLd(toJsonLd(this.#value, this.#lookup.lookup)));
      this._copied = true;
      setTimeout(() => (this._copied = false), 1500);
    } catch {
      // Clipboard access can be refused; the text is still selectable in the preview.
    }
  }

  override render() {
    const items = this.#value.items;
    const enabled = items.filter((item) => item.enabled).length;
    const canAdd = !this.readonly && (this._maxItems === undefined || items.length < this._maxItems);

    return html`
      <div id="cards">
        ${repeat(
          items,
          (item) => item.key,
          (item) => html`
            <koben-sd-entry-card
              data-key=${item.key}
              .item=${item}
              .lookup=${this.#lookup}
              .lookupVersion=${this._lookupVersion}
              ?expanded=${this._expanded.has(item.key)}
              ?readonly=${this.readonly}
              @koben-value-change=${this.#onItemChange}
              @koben-entry-action=${(event: KobenEntryActionEvent) => this.#onAction(item, event)}
              @click=${(event: Event) => {
                // The card toggles itself; mirror its state so the list re-renders it consistently.
                const card = event.currentTarget as HTMLElement & { expanded: boolean };
                queueMicrotask(() => this.#toggleExpanded(item.key, card.expanded));
              }}></koben-sd-entry-card>
          `,
        )}
        ${items.length ? nothing : html`<p class="empty">No structured data on this page yet.</p>`}
      </div>

      <div class="toolbar">
        ${canAdd
          ? html`
              <uui-button look="placeholder" label="Add structured data" @click=${this.#add}>
                <uui-icon name="icon-add"></uui-icon> Add structured data
              </uui-button>
            `
          : nothing}
        <span class="count">
          ${items.length ? html`${items.length} ${items.length === 1 ? "entry" : "entries"}, ${enabled} enabled` : nothing}
          ${this._maxItems !== undefined && items.length >= this._maxItems ? html` · limit of ${this._maxItems} reached` : nothing}
        </span>
        ${this._showPreview && items.length
          ? html`
              <uui-button look="secondary" compact label=${this._previewOpen ? "Hide preview" : "Preview JSON-LD"} @click=${() => (this._previewOpen = !this._previewOpen)}>
                <uui-icon name="icon-code"></uui-icon> ${this._previewOpen ? "Hide preview" : "Preview JSON-LD"}
              </uui-button>
            `
          : nothing}
      </div>

      ${this._previewOpen && this._showPreview ? this.#renderPreview() : nothing}
    `;
  }

  #renderPreview() {
    const nodes = toJsonLd(this.#value, this.#lookup.lookup);
    return html`
      <div class="preview">
        <div class="preview-head">
          <strong>What the page will emit</strong>
          <span class="count">${nodes.length} ${nodes.length === 1 ? "node" : "nodes"}</span>
          <uui-button look="secondary" compact label="Copy" @click=${this.#copyPreview}>${this._copied ? "Copied" : "Copy"}</uui-button>
          <a href=${VALIDATOR_URL} target="_blank" rel="noopener">Test at validator.schema.org ↗</a>
        </div>
        <pre>${nodes.length ? formatJsonLd(nodes) : "Nothing enabled yet."}</pre>
        <p class="note">Page and media references show the URL Umbraco knows now; the site resolves them again on publish.</p>
      </div>
    `;
  }

  static override styles = [
    css`
      :host {
        display: block;
      }

      #cards {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-3);
      }

      .empty {
        margin: 0;
        color: var(--uui-color-text-alt);
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-4);
        margin-top: var(--uui-size-space-3);
      }

      .toolbar uui-button[look="placeholder"] {
        flex: 1;
      }

      .count {
        color: var(--uui-color-text-alt);
        font-size: var(--uui-type-small-size);
      }

      .preview {
        margin-top: var(--uui-size-space-4);
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        background: var(--uui-color-surface-alt);
        padding: var(--uui-size-space-4);
      }

      .preview-head {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-3);
        margin-bottom: var(--uui-size-space-3);
      }

      .preview-head a {
        margin-left: auto;
        font-size: var(--uui-type-small-size);
      }

      pre {
        margin: 0;
        max-height: 420px;
        overflow: auto;
        font-size: 12px;
        line-height: 1.45;
        background: var(--uui-color-surface);
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        padding: var(--uui-size-space-3);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .note {
        margin: var(--uui-size-space-2) 0 0;
        color: var(--uui-color-text-alt);
        font-size: var(--uui-type-small-size);
      }
    `,
  ];
}

export default KobenStructuredDataPropertyEditorUiElement;

declare global {
  interface HTMLElementTagNameMap {
    "koben-sd-property-editor-ui": KobenStructuredDataPropertyEditorUiElement;
  }
}
