import "../node_modules/@umbraco-ui/uui/dist/themes/light.css";
import "@umbraco-cms/backoffice/external/uui";
import "../src/rules/binding-fields.element.js";
import { getDefinition } from "../src/catalogue/index.js";
import type { BindingFields, CultureModel, DocumentTypeModel } from "../src/rules/rules.types.js";

const documentTypes: DocumentTypeModel[] = [
  { alias: "homePage", name: "Home page", isElement: false, properties: [
    { alias: "pageTitle", name: "Page title", editorAlias: "Umbraco.TextBox" },
    { alias: "seoMetaTitle", name: "SEO title", editorAlias: "Umbraco.TextBox" },
    { alias: "heroTitle", name: "Hero title", editorAlias: "Umbraco.TextBox" },
  ] },
  { alias: "contentPage", name: "Content page", isElement: false, properties: [
    { alias: "pageTitle", name: "Page title", editorAlias: "Umbraco.TextBox" },
    { alias: "seoMetaTitle", name: "SEO title", editorAlias: "Umbraco.TextBox" },
    { alias: "heroImage", name: "Hero image", editorAlias: "Umbraco.MediaPicker3" },
  ] },
];

const fields: BindingFields = {
  name: { source: "value", value: "Koben" },
  url: { source: "property", alias: "url", scope: "site" },
  publisher: { source: "ref", target: "organization" },
  description: { source: "property", alias: "seoMetaTitle", fallbackAliases: ["pageTitle"] },
};

const cultures: CultureModel[] = [
  { isoCode: "en-AU", name: "English (Australia)", isDefault: true },
  { isoCode: "fr-FR", name: "French (France)", isDefault: false },
];

const element = document.getElementById("fields") as HTMLElement & { definition: unknown; fields: BindingFields; documentTypes: DocumentTypeModel[]; cultures: CultureModel[] };
element.definition = getDefinition("WebSite");
element.fields = { ...fields, name: { source: "value", value: "Koben", cultureValues: { "fr-FR": "Koben France" } }, alternateName: { source: "dictionary", key: "Site.ShortName" } };
element.documentTypes = documentTypes;
element.cultures = cultures;
