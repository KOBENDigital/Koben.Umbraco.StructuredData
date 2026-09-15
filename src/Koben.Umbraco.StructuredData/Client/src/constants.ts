/** Content-model surface: a data type stores the schema alias, so these never change casually. */
export const STRUCTURED_DATA_SCHEMA_ALIAS = "Koben.StructuredData";
export const STRUCTURED_DATA_PROPERTY_EDITOR_UI_ALIAS = "Koben.PropertyEditorUi.StructuredData";
export const STRUCTURED_DATA_TYPE_LIST_CONFIG_UI_ALIAS = "Koben.PropertyEditorUi.StructuredDataTypeList";
export const STRUCTURED_DATA_TYPE_PICKER_MODAL_ALIAS = "Koben.StructuredData.TypePickerModal";

export const SCHEMA_ORG_CONTEXT = "https://schema.org";
export const CURRENT_VALUE_VERSION = 1;

/** Alias of the raw JSON-LD escape hatch; not a schema.org type. */
export const CUSTOM_TYPE_ALIAS = "custom";

/** Data type configuration aliases, as declared in the manifest settings. */
export const CONFIG = {
  allowedTypes: "allowedTypes",
  maxItems: "maxItems",
  allowCustomJson: "allowCustomJson",
  showPreview: "showPreview",
} as const;
