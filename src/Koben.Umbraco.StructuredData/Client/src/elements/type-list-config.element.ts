import { css, customElement, html, property } from "@umbraco-cms/backoffice/external/lit";
import { UmbChangeEvent } from "@umbraco-cms/backoffice/event";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import type { UmbPropertyEditorUiElement } from "@umbraco-cms/backoffice/property-editor";
import type { UUICheckboxElement } from "@umbraco-cms/backoffice/external/uui";
import { groupOrder, topLevelDefinitions } from "../catalogue/index.js";

/**
 * Data type setting: which catalogue types editors may add. Nothing ticked means everything.
 */
@customElement("koben-sd-type-list-config")
export class KobenStructuredDataTypeListConfigElement extends UmbLitElement implements UmbPropertyEditorUiElement {
  @property({ attribute: false })
  public value: string[] = [];

  #toggle(alias: string, checked: boolean) {
    const current = new Set(Array.isArray(this.value) ? this.value : []);
    if (checked) current.add(alias);
    else current.delete(alias);
    this.value = topLevelDefinitions()
      .map((definition) => definition.alias)
      .filter((candidate) => current.has(candidate));
    this.dispatchEvent(new UmbChangeEvent());
  }

  override render() {
    const selected = new Set(Array.isArray(this.value) ? this.value : []);
    const definitions = topLevelDefinitions();
    return html`
      <p class="help">Leave everything unticked to allow every type.</p>
      ${groupOrder.map((group) => {
        const items = definitions.filter((definition) => definition.group === group);
        if (!items.length) return null;
        return html`
          <h5>${group}</h5>
          <div class="group">
            ${items.map(
              (definition) => html`
                <uui-checkbox
                  label=${definition.label}
                  ?checked=${selected.has(definition.alias)}
                  @change=${(event: Event) => this.#toggle(definition.alias, (event.target as UUICheckboxElement).checked)}>
                  ${definition.label}
                </uui-checkbox>
              `,
            )}
          </div>
        `;
      })}
    `;
  }

  static override styles = [
    css`
      :host {
        display: block;
      }

      .help {
        margin: 0 0 var(--uui-size-space-3);
        color: var(--uui-color-text-alt);
        font-size: var(--uui-type-small-size);
      }

      h5 {
        margin: var(--uui-size-space-3) 0 var(--uui-size-space-1);
        color: var(--uui-color-text-alt);
      }

      .group {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: var(--uui-size-space-1) var(--uui-size-space-4);
      }
    `,
  ];
}

export default KobenStructuredDataTypeListConfigElement;

declare global {
  interface HTMLElementTagNameMap {
    "koben-sd-type-list-config": KobenStructuredDataTypeListConfigElement;
  }
}
