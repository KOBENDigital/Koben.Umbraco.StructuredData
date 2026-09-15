import "../node_modules/@umbraco-ui/uui-css/dist/uui-css.css";
import "@umbraco-cms/backoffice/external/uui";
import "../src/rules/rule-editor.element.js";
import { topLevelDefinitions } from "../src/catalogue/index.js";
import { ruleFromTemplate } from "../src/rules/templates.js";
import type { CultureModel, DocumentTypeModel, RuleModel, SiteModel } from "../src/rules/rules.types.js";

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

const sites: SiteModel[] = [
  { key: "a", name: "Main site", domains: [{ domainName: "www.example.com" }] },
  { key: "b", name: "Second site", domains: [] },
];

const cultures: CultureModel[] = [
  { isoCode: "en-AU", name: "English (Australia)", isDefault: true },
  { isoCode: "fr-FR", name: "French (France)", isDefault: false },
];

const editor = document.getElementById("editor") as HTMLElement & { rule: RuleModel; documentTypes: DocumentTypeModel[]; sites: SiteModel[]; cultures: CultureModel[] };
const picker = document.getElementById("type") as HTMLSelectElement;
for (const definition of topLevelDefinitions()) {
  const option = document.createElement("option");
  option.value = definition.alias;
  option.textContent = definition.label;
  picker.append(option);
}

function load(type: string) {
  const params = new URLSearchParams(location.search);
  // ?empty=1 shows the rule with no bindings, so the "Usually: …" suggestions are visible.
  const rule = params.get("empty") ? { ...ruleFromTemplate(type), definition: { ...ruleFromTemplate(type).definition, fields: {} } } : ruleFromTemplate(type);
  editor.rule = rule;
}

picker.value = new URLSearchParams(location.search).get("type") ?? "WebPage";
editor.documentTypes = documentTypes;
editor.sites = sites;
editor.cultures = cultures;
load(picker.value);
picker.addEventListener("change", () => load(picker.value));
