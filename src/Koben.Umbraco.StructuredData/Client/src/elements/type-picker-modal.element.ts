import { css, customElement, html, nothing, repeat, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbModalBaseElement } from "@umbraco-cms/backoffice/modal";
import type { UUIInputElement } from "@umbraco-cms/backoffice/external/uui";
import { groupOrder, topLevelDefinitions, type TypeDefinition } from "../catalogue/index.js";
import { CUSTOM_TYPE_ALIAS } from "../constants.js";
import type { KobenTypePickerModalData, KobenTypePickerModalValue } from "./type-picker-modal.token.js";

/** Lists the catalogue by group with a filter; choosing a type submits and closes. */
@customElement("koben-sd-type-picker-modal")
export class KobenStructuredDataTypePickerModalElement extends UmbModalBaseElement<KobenTypePickerModalData, KobenTypePickerModalValue> {
  @state()
  private _filter = "";

  get #definitions(): TypeDefinition[] {
    const allowed = this.data?.allowedTypes ?? [];
    const filter = this._filter.trim().toLowerCase();
    return topLevelDefinitions().filter(
      (definition) =>
        (!allowed.length || allowed.includes(definition.alias)) &&
        (!filter || definition.label.toLowerCase().includes(filter) || definition.alias.toLowerCase().includes(filter) || definition.description.toLowerCase().includes(filter)),
    );
  }

  #choose(type: string) {
    this.value = { type };
    this._submitModal();
  }

  override render() {
    const definitions = this.#definitions;
    const groups = groupOrder.map((group) => ({ group, items: definitions.filter((definition) => definition.group === group) })).filter((entry) => entry.items.length);
    const showCustom = this.data?.allowCustomJson !== false && (!this._filter || "custom json-ld".includes(this._filter.trim().toLowerCase()));

    return html`
      <umb-body-layout headline="Add structured data">
        <div class="content">
          <uui-input
            id="filter"
            label="Filter types"
            placeholder="Filter…"
            autofocus
            .value=${this._filter}
            @input=${(event: Event) => (this._filter = (event.target as UUIInputElement).value as string)}></uui-input>

          ${groups.length || showCustom ? nothing : html`<p class="empty">No types match "${this._filter}".</p>`}

          ${repeat(
            groups,
            (entry) => entry.group,
            (entry) => html`
              <h4>${entry.group}</h4>
              <div class="grid">
                ${entry.items.map(
                  (definition) => html`
                    <button class="card" type="button" @click=${() => this.#choose(definition.alias)}>
                      <umb-icon name=${definition.icon}></umb-icon>
                      <span class="card-label">${definition.label}</span>
                      <span class="card-desc">${definition.description}</span>
                    </button>
                  `,
                )}
              </div>
            `,
          )}

          ${showCustom
            ? html`
                <h4>Advanced</h4>
                <div class="grid">
                  <button class="card" type="button" @click=${() => this.#choose(CUSTOM_TYPE_ALIAS)}>
                    <umb-icon name="icon-code"></umb-icon>
                    <span class="card-label">Custom JSON-LD</span>
                    <span class="card-desc">Paste any schema.org object the catalogue does not cover.</span>
                  </button>
                </div>
              `
            : nothing}
        </div>
        <div slot="actions">
          <uui-button label="Cancel" look="secondary" @click=${() => this._rejectModal()}>Cancel</uui-button>
        </div>
      </umb-body-layout>
    `;
  }

  static override styles = [
    css`
      .content {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-3);
      }

      #filter {
        width: 100%;
      }

      h4 {
        margin: var(--uui-size-space-4) 0 var(--uui-size-space-1);
        color: var(--uui-color-text-alt);
        font-weight: 600;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: var(--uui-size-space-3);
      }

      .card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--uui-size-space-1);
        text-align: left;
        padding: var(--uui-size-space-4);
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        background: var(--uui-color-surface);
        font: inherit;
        color: inherit;
        cursor: pointer;
      }

      .card:hover,
      .card:focus-visible {
        border-color: var(--uui-color-interactive-emphasis);
        background: var(--uui-color-surface-alt);
        outline: none;
      }

      .card umb-icon {
        font-size: 1.6em;
        color: var(--uui-color-interactive);
      }

      .card-label {
        font-weight: 600;
      }

      .card-desc {
        font-size: var(--uui-type-small-size);
        color: var(--uui-color-text-alt);
      }

      .empty {
        color: var(--uui-color-text-alt);
      }
    `,
  ];
}

export default KobenStructuredDataTypePickerModalElement;

declare global {
  interface HTMLElementTagNameMap {
    "koben-sd-type-picker-modal": KobenStructuredDataTypePickerModalElement;
  }
}
