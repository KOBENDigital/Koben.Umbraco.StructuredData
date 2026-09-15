import { css, customElement, html } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";

@customElement("koben-sd-rules-workspace")
export class KobenStructuredDataRulesWorkspaceElement extends UmbLitElement {
  override render() {
    return html`<umb-workspace-editor headline="Structured data" .enforceNoFooter=${true}></umb-workspace-editor>`;
  }

  static override styles = [
    css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ];
}

export default KobenStructuredDataRulesWorkspaceElement;
export { KobenStructuredDataRulesWorkspaceElement as element };
