import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UmbDocumentItemRepository, UmbDocumentUrlRepository } from "@umbraco-cms/backoffice/document";
import { UmbMediaItemRepository, UmbMediaUrlRepository } from "@umbraco-cms/backoffice/media";
import { isReference, type JsonValue, type ReferenceValue, type StructuredDataValue } from "./model.js";
import type { ReferenceLookup, ResolvedReference } from "./jsonld.js";

export interface ReferenceDetails extends ResolvedReference {
  name?: string;
}

/**
 * Fetches names and URLs for every media and document reference in a value, so the preview can
 * show real URLs and the form can label a picked item. Batched per kind, cached per key, and
 * silent on failure: an editor's preview must never break because an item was deleted.
 */
export class KobenReferenceLookup {
  #host: UmbControllerHost;
  #cache = new Map<string, ReferenceDetails>();
  #pending = new Map<string, Promise<void>>();

  constructor(host: UmbControllerHost) {
    this.#host = host;
  }

  /** Every reference in the value that is not yet cached is fetched; resolves when all are known. */
  async warm(value: StructuredDataValue): Promise<void> {
    const media = new Set<string>();
    const documents = new Set<string>();
    for (const item of value.items) collectReferences(item.node, media, documents);

    await Promise.all([this.#fetch("media", [...media]), this.#fetch("document", [...documents])]);
  }

  get lookup(): ReferenceLookup {
    return (reference: ReferenceValue) => this.#cache.get(cacheKey(reference));
  }

  details(reference: ReferenceValue): ReferenceDetails | undefined {
    return this.#cache.get(cacheKey(reference));
  }

  async #fetch(kind: ReferenceValue["$ref"], keys: string[]): Promise<void> {
    const wanted = keys.filter((key) => key && !this.#cache.has(`${kind}:${key}`));
    if (!wanted.length) return;

    const signature = `${kind}:${wanted.slice().sort().join(",")}`;
    const inFlight = this.#pending.get(signature);
    if (inFlight) return inFlight;

    const run = (async () => {
      try {
        if (kind === "media") {
          const [items, urls] = await Promise.all([
            new UmbMediaItemRepository(this.#host).requestItems(wanted),
            new UmbMediaUrlRepository(this.#host).requestItems(wanted),
          ]);
          for (const key of wanted) {
            const item = items.data?.find((entry) => entry.unique === key);
            const url = urls.data?.find((entry) => entry.unique === key);
            this.#cache.set(`media:${key}`, {
              ...(item?.name ? { name: item.name } : {}),
              ...(url?.url ? { url: url.url } : {}),
            });
          }
        } else {
          const [items, urls] = await Promise.all([
            new UmbDocumentItemRepository(this.#host).requestItems(wanted),
            new UmbDocumentUrlRepository(this.#host).requestItems(wanted),
          ]);
          for (const key of wanted) {
            const item = items.data?.find((entry) => entry.unique === key);
            const urlSet = urls.data?.find((entry) => entry.unique === key);
            const url = urlSet?.urls.find((entry) => entry.url)?.url;
            const name = item?.variants.find((variant) => variant.name)?.name;
            this.#cache.set(`document:${key}`, {
              ...(name ? { name } : {}),
              ...(url ? { url } : {}),
            });
          }
        }
      } catch {
        // Leave the keys uncached so a later warm() can retry; the preview shows placeholders.
      } finally {
        this.#pending.delete(signature);
      }
    })();

    this.#pending.set(signature, run);
    return run;
  }
}

function cacheKey(reference: ReferenceValue): string {
  return `${reference.$ref}:${reference.key}`;
}

function collectReferences(node: JsonValue, media: Set<string>, documents: Set<string>): void {
  if (node === null || typeof node !== "object") return;
  if (isReference(node)) {
    (node.$ref === "media" ? media : documents).add(node.key);
    return;
  }
  for (const member of Array.isArray(node) ? node : Object.values(node)) collectReferences(member, media, documents);
}
