import type { ManifestModal } from "@umbraco-cms/backoffice/modal";
import type { ManifestPropertyEditorSchema, ManifestPropertyEditorUi } from "@umbraco-cms/backoffice/property-editor";
import {
  CONFIG,
  STRUCTURED_DATA_PROPERTY_EDITOR_UI_ALIAS,
  STRUCTURED_DATA_SCHEMA_ALIAS,
  STRUCTURED_DATA_TYPE_LIST_CONFIG_UI_ALIAS,
  STRUCTURED_DATA_TYPE_PICKER_MODAL_ALIAS,
} from "./constants.js";
import { rulesManifests } from "./rules/manifests.js";

export { STRUCTURED_DATA_PROPERTY_EDITOR_UI_ALIAS, STRUCTURED_DATA_SCHEMA_ALIAS } from "./constants.js";
export { catalogue, getDefinition } from "./catalogue/index.js";
export { toJsonLd } from "./jsonld.js";

const schemaManifest: ManifestPropertyEditorSchema = {
  type: "propertyEditorSchema",
  alias: STRUCTURED_DATA_SCHEMA_ALIAS,
  name: "Structured Data",
  meta: {
    defaultPropertyEditorUiAlias: STRUCTURED_DATA_PROPERTY_EDITOR_UI_ALIAS,
    settings: {
      properties: [
        {
          alias: CONFIG.allowedTypes,
          label: "Allowed types",
          description: "Restrict which schema.org types editors can add. Leave empty to allow all.",
          propertyEditorUiAlias: STRUCTURED_DATA_TYPE_LIST_CONFIG_UI_ALIAS,
        },
        {
          alias: CONFIG.maxItems,
          label: "Maximum entries",
          description: "Leave blank for no limit.",
          propertyEditorUiAlias: "Umb.PropertyEditorUi.Integer",
        },
        {
          alias: CONFIG.allowCustomJson,
          label: "Allow custom JSON-LD",
          description: "Lets editors paste raw JSON-LD for types the catalogue does not cover.",
          propertyEditorUiAlias: "Umb.PropertyEditorUi.Toggle",
        },
      ],
      defaultData: [{ alias: CONFIG.allowCustomJson, value: true }],
    },
  },
};

const uiManifest: ManifestPropertyEditorUi = {
  type: "propertyEditorUi",
  alias: STRUCTURED_DATA_PROPERTY_EDITOR_UI_ALIAS,
  name: "Structured Data Property Editor UI",
  element: () => import("./elements/property-editor-ui.element.js"),
  meta: {
    label: "Structured Data (schema.org)",
    icon: "icon-code",
    group: "common",
    propertyEditorSchemaAlias: STRUCTURED_DATA_SCHEMA_ALIAS,
    supportsReadOnly: true,
    settings: {
      properties: [
        {
          alias: CONFIG.showPreview,
          label: "Show JSON-LD preview",
          description: "Offers editors a preview of what the page will emit.",
          propertyEditorUiAlias: "Umb.PropertyEditorUi.Toggle",
        },
      ],
      defaultData: [{ alias: CONFIG.showPreview, value: true }],
    },
  },
};

const typeListConfigManifest: ManifestPropertyEditorUi = {
  type: "propertyEditorUi",
  alias: STRUCTURED_DATA_TYPE_LIST_CONFIG_UI_ALIAS,
  name: "Structured Data Allowed Types",
  element: () => import("./elements/type-list-config.element.js"),
  meta: {
    label: "Structured Data Allowed Types",
    icon: "icon-bulleted-list",
    group: "common",
    // Configuration-only: not offered when building a data type.
    propertyEditorSchemaAlias: undefined,
  },
};

const typePickerModalManifest: ManifestModal = {
  type: "modal",
  alias: STRUCTURED_DATA_TYPE_PICKER_MODAL_ALIAS,
  name: "Structured Data Type Picker Modal",
  element: () => import("./elements/type-picker-modal.element.js"),
};

export const manifests: Array<ManifestPropertyEditorSchema | ManifestPropertyEditorUi | ManifestModal | (typeof rulesManifests)[number]> = [
  schemaManifest,
  uiManifest,
  typeListConfigManifest,
  typePickerModalManifest,
  ...rulesManifests,
];
