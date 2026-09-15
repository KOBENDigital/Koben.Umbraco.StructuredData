import { umbHttpClient } from "@umbraco-cms/backoffice/http-client";
import type { CultureModel, DocumentTypeModel, NodesResponse, RuleModel, RulesExport, SiteModel } from "./rules.types.js";

const BASE = "/umbraco/management/api/v1/structured-data";
const SECURITY = [{ type: "http", scheme: "bearer" }] as const;

export class RulesApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly type?: string,
  ) {
    super(message);
  }
}

type Problem = { title?: string; detail?: string; type?: string; status?: number };

/**
 * The package's Management API through the backoffice's own configured client, so auth and the
 * server origin come for free. Failures surface as one error type with the problem's own words.
 */
async function unwrap<T>(call: Promise<{ data?: unknown; error?: unknown; response?: Response }>): Promise<T> {
  const result = await call;
  if (result.response?.ok) {
    return result.data as T;
  }

  const status = result.response?.status ?? 0;
  const problem = (result.error ?? {}) as Problem;
  const message = problem.detail ?? problem.title ?? (status ? `The request failed (${status}).` : "The server could not be reached.");
  throw new RulesApiError(message, status, problem.type);
}

export const rulesApi = {
  list: () => unwrap<RuleModel[]>(umbHttpClient.get({ url: `${BASE}/rules`, security: [...SECURITY] })),
  get: (key: string) => unwrap<RuleModel>(umbHttpClient.get({ url: `${BASE}/rules/${key}`, security: [...SECURITY] })),
  create: (rule: RuleModel) => unwrap<RuleModel>(umbHttpClient.post({ url: `${BASE}/rules`, body: rule, security: [...SECURITY] })),
  update: (key: string, rule: RuleModel) => unwrap<RuleModel>(umbHttpClient.put({ url: `${BASE}/rules/${key}`, body: rule, security: [...SECURITY] })),
  remove: (key: string) => unwrap<unknown>(umbHttpClient.delete({ url: `${BASE}/rules/${key}`, security: [...SECURITY] })),
  documentTypes: () => unwrap<DocumentTypeModel[]>(umbHttpClient.get({ url: `${BASE}/document-types`, security: [...SECURITY] })),
  sites: () => unwrap<SiteModel[]>(umbHttpClient.get({ url: `${BASE}/sites`, security: [...SECURITY] })),
  cultures: () => unwrap<CultureModel[]>(umbHttpClient.get({ url: `${BASE}/cultures`, security: [...SECURITY] })),
  preview: (rule: RuleModel, documentId: string, culture?: string) =>
    unwrap<NodesResponse>(umbHttpClient.post({ url: `${BASE}/rules/preview`, body: { rule, documentId, culture: culture || null }, security: [...SECURITY] })),
  graph: (documentId: string) => unwrap<NodesResponse>(umbHttpClient.get({ url: `${BASE}/graph/${documentId}`, security: [...SECURITY] })),
  exportAll: () => unwrap<RulesExport>(umbHttpClient.get({ url: `${BASE}/rules/export`, security: [...SECURITY] })),
  importAll: (payload: RulesExport & { replace: boolean }) =>
    unwrap<RuleModel[]>(umbHttpClient.post({ url: `${BASE}/rules/import`, body: payload, security: [...SECURITY] })),
};
