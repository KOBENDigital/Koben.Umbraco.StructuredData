import type { ManifestMenuItem } from "@umbraco-cms/backoffice/menu";
import type { ManifestWorkspace, ManifestWorkspaceView } from "@umbraco-cms/backoffice/workspace";

export const RULES_ENTITY_TYPE = "koben-structured-data-rules";
export const RULES_WORKSPACE_ALIAS = "Koben.Workspace.StructuredDataRules";

const menuItem: ManifestMenuItem = {
  type: "menuItem",
  alias: "Koben.MenuItem.StructuredDataRules",
  name: "Structured Data Rules Menu Item",
  weight: 250,
  meta: {
    label: "Structured data",
    icon: "icon-code",
    entityType: RULES_ENTITY_TYPE,
    menus: ["Umb.Menu.AdvancedSettings"],
  },
};

const workspace: ManifestWorkspace = {
  type: "workspace",
  alias: RULES_WORKSPACE_ALIAS,
  name: "Structured Data Rules Workspace",
  element: () => import("./rules-workspace.element.js"),
  api: () => import("./rules-workspace.context.js"),
  meta: {
    entityType: RULES_ENTITY_TYPE,
  },
};

const rulesView: ManifestWorkspaceView = {
  type: "workspaceView",
  alias: "Koben.WorkspaceView.StructuredDataRules.Rules",
  name: "Structured Data Rules View",
  element: () => import("./rules-view.element.js"),
  weight: 200,
  meta: {
    label: "Generation rules",
    pathname: "rules",
    icon: "icon-code",
  },
  conditions: [{ alias: "Umb.Condition.WorkspaceAlias", match: RULES_WORKSPACE_ALIAS }],
};

export const rulesManifests = [menuItem, workspace, rulesView];
