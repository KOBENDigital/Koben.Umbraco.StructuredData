import { UmbContextBase } from "@umbraco-cms/backoffice/class-api";
import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UMB_WORKSPACE_CONTEXT, type UmbWorkspaceContext } from "@umbraco-cms/backoffice/workspace";
import { RULES_ENTITY_TYPE, RULES_WORKSPACE_ALIAS } from "./manifests.js";

/** A static workspace: no entity to load, it exists so the editor's views can attach to it. */
export class KobenStructuredDataRulesWorkspaceContext extends UmbContextBase implements UmbWorkspaceContext {
  public readonly workspaceAlias = RULES_WORKSPACE_ALIAS;

  constructor(host: UmbControllerHost) {
    super(host, UMB_WORKSPACE_CONTEXT);
  }

  getEntityType(): string {
    return RULES_ENTITY_TYPE;
  }
}

export { KobenStructuredDataRulesWorkspaceContext as api };
