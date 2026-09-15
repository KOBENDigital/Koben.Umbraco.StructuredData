import { css, customElement, html, nothing, property, repeat } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import type { UUIInputElement, UUISelectElement, UUITextareaElement, UUIToggleElement } from "@umbraco-cms/backoffice/external/uui";
import type { UmbInputDocumentElement } from "@umbraco-cms/backoffice/document";
import type { UmbInputMediaElement } from "@umbraco-cms/backoffice/media";
import { fieldHelpText, getDefinition, type EntityField, type Field, type ListField, type TypeDefinition } from "../catalogue/index.js";
import { KobenValueChangeEvent } from "../events.js";
import { isJsonObject, isReference, type JsonObject, type JsonValue, type ReferenceValue } from "../model.js";
import type { KobenReferenceLookup } from "../reference-lookup.js";
// Side-effect imports: guarantee the shared inputs and icon element are defined wherever this form renders.
import "@umbraco-cms/backoffice/components";
import "@umbraco-cms/backoffice/icon";

type ListMember = ListField["of"];

/**
 * Renders a catalogue definition's fields against one JSON-LD node and emits a replacement node on
 * every edit. Nested entities and lists render this same element recursively.
 */
@customElement("koben-sd-entity-form")
export class KobenStructuredDataEntityFormElement extends UmbLitElement {
  @property({ attribute: false })
  public definition?: TypeDefinition;

  @property({ attribute: false })
  public node: JsonObject = {};

  /** Nested forms use the definition's shorter field set. */
  @property({ type: Boolean })
  public nested = false;

  @property({ type: Boolean, reflect: true })
  public readonly = false;

  @property({ attribute: false })
  public lookup?: KobenReferenceLookup;

  /** Bumped by the owner when the lookup has new answers, so picked items relabel. */
  @property({ type: Number })
  public lookupVersion = 0;

  #emit(node: JsonObject) {
    this.node = node;
    this.dispatchEvent(new KobenValueChangeEvent(node));
  }

  #set(key: string, value: JsonValue | undefined) {
    const next: JsonObject = { ...this.node };
    if (value === undefined) delete next[key];
    else next[key] = value;
    this.#emit(next);
  }

  get #fields(): Field[] {
    if (!this.definition) return [];
    return this.nested && this.definition.nestedFields ? this.definition.nestedFields : this.definition.fields;
  }

  override render() {
    if (!this.definition) return nothing;
    return html`
      ${this.#renderVariantSelect()}
      ${repeat(
        this.#fields,
        (field) => field.key,
        (field) => this.#renderField(field),
      )}
    `;
  }

  #renderVariantSelect() {
    const variants = this.definition?.typeVariants;
    if (!variants?.length) return nothing;
    const current = String(this.node["@type"] ?? variants[0]?.value ?? "");
    return html`
      <umb-property-layout orientation="vertical" label="Type" description="The precise schema.org type to emit.">
        <div slot="editor">
          <uui-select
            label="Type"
            .options=${variants.map((variant) => ({ name: variant.label, value: variant.value, selected: variant.value === current }))}
            ?disabled=${this.readonly}
            @change=${(event: Event) => this.#set("@type", (event.target as UUISelectElement).value as string)}></uui-select>
        </div>
      </umb-property-layout>
    `;
  }

  #renderField(field: Field) {
    const value = this.node[field.key];

    // A single-field inline entity is labelled by that field; a second label above it would repeat it.
    if (field.kind === "entity" && field.inline) {
      const inlineDefinition = getDefinition(field.types[0] ?? "");
      const inlineFields = inlineDefinition ? (inlineDefinition.nestedFields ?? inlineDefinition.fields) : [];
      if (inlineFields.length === 1) {
        return this.#renderInlineEntity(field, value, (next) => this.#set(field.key, next));
      }
    }

    const label = field.required ? `${field.label} *` : field.label;
    // The layout renders its description as markdown: a bold "Required." or "Recommended." lead-in, then the help and an example.
    return html`
      <umb-property-layout orientation="vertical" .label=${label} .description=${fieldHelpText(field)}>
        <div slot="editor">${this.#renderInput(field, value)}</div>
      </umb-property-layout>
    `;
  }

  #renderInput(field: Field, value: JsonValue | undefined) {
    switch (field.kind) {
      case "text":
      case "url":
      case "email":
      case "tel":
      case "duration":
        return this.#renderText(field.key, value, field.kind === "duration" ? "text" : field.kind, field.placeholder);
      case "number":
        return this.#renderNumber(field.key, value, field.placeholder);
      case "textarea":
        return html`
          <uui-textarea
            label=${field.label}
            .value=${typeof value === "string" ? value : ""}
            placeholder=${field.placeholder ?? ""}
            ?readonly=${this.readonly}
            @input=${(event: Event) => this.#set(field.key, (event.target as UUITextareaElement).value as string)}></uui-textarea>
        `;
      case "date":
      case "datetime":
        return this.#renderDate(field.key, value, field.kind === "date" ? "date" : "datetime-local");
      case "boolean":
        return html`
          <uui-toggle
            label=${field.label}
            ?checked=${value === true}
            ?disabled=${this.readonly}
            @change=${(event: Event) => this.#set(field.key, (event.target as UUIToggleElement).checked ? true : undefined)}></uui-toggle>
        `;
      case "select":
        return html`
          <uui-select
            label=${field.label}
            placeholder="Choose…"
            .options=${field.options.map((option) => ({ name: option.label, value: option.value, selected: option.value === value }))}
            ?disabled=${this.readonly}
            @change=${(event: Event) => {
              const chosen = (event.target as UUISelectElement).value as string;
              this.#set(field.key, chosen ? chosen : undefined);
            }}></uui-select>
        `;
      case "image":
        return this.#renderMedia(isReference(value) ? value.key : "", (key) =>
          this.#set(field.key, key ? { $ref: "media", key, ...(field.as ? { as: field.as } : {}) } : undefined),
        );
      case "document":
        return this.#renderDocument(isReference(value) ? value.key : "", (key) => this.#set(field.key, key ? { $ref: "document", key } : undefined));
      case "link":
        return this.#renderLink(value, (next) => this.#set(field.key, next));
      case "entity":
        return field.inline
          ? this.#renderInlineEntity(field, value, (next) => this.#set(field.key, next))
          : this.#renderEntity(field, value, (next) => this.#set(field.key, next));
      case "list":
        return this.#renderList(field, value);
    }
  }

  #renderText(key: string, value: JsonValue | undefined, type: "text" | "url" | "email" | "tel", placeholder?: string) {
    return html`
      <uui-input
        label=${key}
        type=${type}
        .value=${typeof value === "string" || typeof value === "number" ? String(value) : ""}
        placeholder=${placeholder ?? ""}
        ?readonly=${this.readonly}
        @input=${(event: Event) => this.#set(key, (event.target as UUIInputElement).value as string)}></uui-input>
    `;
  }

  #renderNumber(key: string, value: JsonValue | undefined, placeholder?: string) {
    return html`
      <uui-input
        label=${key}
        type="number"
        step="any"
        .value=${typeof value === "number" ? String(value) : typeof value === "string" ? value : ""}
        placeholder=${placeholder ?? ""}
        ?readonly=${this.readonly}
        @input=${(event: Event) => {
          const text = String((event.target as UUIInputElement).value ?? "").trim();
          const parsed = Number(text);
          this.#set(key, text === "" ? undefined : Number.isFinite(parsed) ? parsed : text);
        }}></uui-input>
    `;
  }

  #renderDate(key: string, value: JsonValue | undefined, type: "date" | "datetime-local") {
    const text = typeof value === "string" ? value : "";
    // schema.org wants ISO 8601; a datetime-local input speaks "YYYY-MM-DDTHH:mm", which is a valid prefix.
    return html`
      <umb-input-date
        label=${key}
        .type=${type}
        .value=${type === "date" ? text.slice(0, 10) : text.slice(0, 16)}
        ?readonly=${this.readonly}
        @change=${(event: Event) => this.#set(key, String((event.target as UUIInputElement).value ?? "") || undefined)}></umb-input-date>
    `;
  }

  #renderMedia(key: string, onPick: (key: string) => void) {
    return html`
      <umb-input-media
        .max=${1}
        .value=${key}
        ?readonly=${this.readonly}
        @change=${(event: Event) => onPick((event.target as UmbInputMediaElement).selection[0] ?? "")}></umb-input-media>
    `;
  }

  #renderDocument(key: string, onPick: (key: string) => void) {
    return html`
      <umb-input-document
        .max=${1}
        .value=${key}
        ?readonly=${this.readonly}
        @change=${(event: Event) => onPick((event.target as UmbInputDocumentElement).selection[0] ?? "")}></umb-input-document>
    `;
  }

  #renderLink(value: JsonValue | undefined, onChange: (next: JsonValue | undefined) => void) {
    const asPage = isReference(value);
    return html`
      <div class="link">
        <uui-button-group>
          <uui-button
            label="URL"
            look=${asPage ? "outline" : "primary"}
            compact
            ?disabled=${this.readonly}
            @click=${() => asPage && onChange(undefined)}>URL</uui-button>
          <uui-button
            label="Page"
            look=${asPage ? "primary" : "outline"}
            compact
            ?disabled=${this.readonly}
            @click=${() => !asPage && onChange({ $ref: "document", key: "" })}>Page</uui-button>
        </uui-button-group>
        <div class="link-input">
          ${asPage
            ? this.#renderDocument(value.key, (key) => onChange({ $ref: "document", key }))
            : html`
                <uui-input
                  label="URL"
                  type="url"
                  placeholder="https://"
                  .value=${typeof value === "string" ? value : ""}
                  ?readonly=${this.readonly}
                  @input=${(event: Event) => onChange((event.target as UUIInputElement).value as string)}></uui-input>
              `}
        </div>
      </div>
    `;
  }

  #renderEntity(field: Pick<EntityField, "types" | "label">, value: JsonValue | undefined, onChange: (next: JsonValue | undefined) => void) {
    if (!isJsonObject(value)) {
      return html`
        <div class="entity-add">
          ${field.types.map(
            (type) => html`
              <uui-button
                look="outline"
                compact
                label="Add ${getDefinition(type)?.label ?? type}"
                ?disabled=${this.readonly}
                @click=${() => onChange(this.#blankEntity(type))}>
                <uui-icon name="icon-add"></uui-icon> Add ${getDefinition(type)?.label ?? type}
              </uui-button>
            `,
          )}
        </div>
      `;
    }

    const currentType = String(value["@type"] ?? field.types[0] ?? "");
    const definition = getDefinition(currentType);
    return html`
      <div class="entity">
        <div class="entity-head">
          <umb-icon name=${definition?.icon ?? "icon-box"}></umb-icon>
          ${field.types.length > 1
            ? html`
                <uui-select
                  label="Type"
                  .options=${field.types.map((type) => ({ name: getDefinition(type)?.label ?? type, value: type, selected: type === currentType }))}
                  ?disabled=${this.readonly}
                  @change=${(event: Event) => onChange(this.#blankEntity((event.target as UUISelectElement).value as string))}></uui-select>
              `
            : html`<span class="entity-type">${definition?.label ?? currentType}</span>`}
          <uui-button
            label="Remove ${field.label}"
            look="secondary"
            color="danger"
            compact
            ?disabled=${this.readonly}
            @click=${() => onChange(undefined)}>
            <uui-icon name="icon-trash"></uui-icon>
          </uui-button>
        </div>
        <koben-sd-entity-form
          nested
          .definition=${definition}
          .node=${value}
          .lookup=${this.lookup}
          .lookupVersion=${this.lookupVersion}
          ?readonly=${this.readonly}
          @koben-value-change=${(event: KobenValueChangeEvent<JsonObject>) => onChange(event.value)}></koben-sd-entity-form>
      </div>
    `;
  }

  /** A required single-type entity reads best as part of its parent: no header, no remove. */
  #renderInlineEntity(field: EntityField, value: JsonValue | undefined, onChange: (next: JsonValue | undefined) => void) {
    const type = field.types[0] ?? "Thing";
    const node = isJsonObject(value) ? value : this.#blankEntity(type);
    const definition = getDefinition(String(node["@type"] ?? type));
    return html`
      <div class="entity inline">
        <koben-sd-entity-form
          nested
          .definition=${definition}
          .node=${node}
          .lookup=${this.lookup}
          .lookupVersion=${this.lookupVersion}
          ?readonly=${this.readonly}
          @koben-value-change=${(event: KobenValueChangeEvent<JsonObject>) => onChange(event.value)}></koben-sd-entity-form>
      </div>
    `;
  }

  #blankEntity(type: string): JsonObject {
    const definition = getDefinition(type);
    return { "@type": type, ...(definition?.defaults ? structuredClone(definition.defaults) : {}) };
  }

  #renderList(field: ListField, value: JsonValue | undefined) {
    const members: JsonValue[] = Array.isArray(value) ? value : [];
    const of = field.of;

    const update = (next: JsonValue[]) => {
      const positioned = field.autoPosition
        ? next.map((member, index) => (isJsonObject(member) ? { ...member, position: index + 1 } : member))
        : next;
      this.#set(field.key, positioned.length ? positioned : undefined);
    };
    const replaceAt = (index: number, member: JsonValue | undefined) =>
      update(member === undefined ? members.filter((_, i) => i !== index) : members.map((existing, i) => (i === index ? member : existing)));
    const move = (index: number, delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= members.length) return;
      const next = [...members];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved as JsonValue);
      update(next);
    };
    const add = (type?: string) => update([...members, this.#blankMember(of, type)]);

    return html`
      <div class="list">
        ${repeat(
          members,
          (_, index) => index,
          (member, index) => html`
            <div class="list-row">
              <div class="list-member">${this.#renderMember(of, member, (next) => replaceAt(index, next))}</div>
              <div class="list-actions">
                <uui-button label="Move up" compact look="secondary" ?disabled=${this.readonly || index === 0} @click=${() => move(index, -1)}>
                  <uui-icon name="icon-arrow-up"></uui-icon>
                </uui-button>
                <uui-button label="Move down" compact look="secondary" ?disabled=${this.readonly || index === members.length - 1} @click=${() => move(index, 1)}>
                  <uui-icon name="icon-arrow-down"></uui-icon>
                </uui-button>
                <uui-button label="Remove" compact look="secondary" color="danger" ?disabled=${this.readonly} @click=${() => replaceAt(index, undefined)}>
                  <uui-icon name="icon-trash"></uui-icon>
                </uui-button>
              </div>
            </div>
          `,
        )}
        <div class="entity-add">
          ${of.kind === "entity"
            ? of.types.map(
                (type) => html`
                  <uui-button look="outline" compact label="Add ${getDefinition(type)?.label ?? type}" ?disabled=${this.readonly} @click=${() => add(type)}>
                    <uui-icon name="icon-add"></uui-icon> Add ${getDefinition(type)?.label ?? type}
                  </uui-button>
                `,
              )
            : html`
                <uui-button look="outline" compact label="Add" ?disabled=${this.readonly} @click=${() => add()}>
                  <uui-icon name="icon-add"></uui-icon> Add
                </uui-button>
              `}
        </div>
      </div>
    `;
  }

  #blankMember(of: ListMember, type?: string): JsonValue {
    switch (of.kind) {
      case "entity":
        return this.#blankEntity(type ?? of.types[0] ?? "Thing");
      case "image":
        return { $ref: "media", key: "", ...(of.as ? { as: of.as } : {}) };
      case "link":
        return "";
      default:
        return "";
    }
  }

  #renderMember(of: ListMember, member: JsonValue, onChange: (next: JsonValue | undefined) => void) {
    switch (of.kind) {
      case "entity":
        return this.#renderEntity({ types: of.types, label: "item" }, member, onChange);
      case "image":
        return this.#renderMedia(isReference(member) ? member.key : "", (key) => onChange({ $ref: "media", key, ...(of.as ? { as: of.as } : {}) }));
      case "link":
        return this.#renderLink(member, onChange);
      case "number":
        return html`
          <uui-input
            label="value"
            type="number"
            step="any"
            .value=${typeof member === "number" ? String(member) : ""}
            ?readonly=${this.readonly}
            @input=${(event: Event) => {
              const parsed = Number((event.target as UUIInputElement).value);
              onChange(Number.isFinite(parsed) ? parsed : "");
            }}></uui-input>
        `;
      case "textarea":
        return html`
          <uui-textarea
            label="value"
            .value=${typeof member === "string" ? member : ""}
            ?readonly=${this.readonly}
            @input=${(event: Event) => onChange((event.target as UUITextareaElement).value as string)}></uui-textarea>
        `;
      default:
        return html`
          <uui-input
            label="value"
            type=${of.kind === "url" || of.kind === "email" || of.kind === "tel" ? of.kind : "text"}
            placeholder=${of.placeholder ?? ""}
            .value=${typeof member === "string" ? member : ""}
            ?readonly=${this.readonly}
            @input=${(event: Event) => onChange((event.target as UUIInputElement).value as string)}></uui-input>
        `;
    }
  }

  static override styles = [
    css`
      :host {
        display: block;
      }

      umb-property-layout {
        padding: var(--uui-size-space-3) 0;
      }

      uui-input,
      uui-textarea,
      uui-select,
      umb-input-date {
        width: 100%;
      }

      .link {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
      }

      .link-input {
        width: 100%;
      }

      .entity {
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        background: var(--uui-color-surface-alt);
        padding: var(--uui-size-space-3) var(--uui-size-space-4);
      }

      .entity.inline {
        padding-top: 0;
        padding-bottom: 0;
      }

      .entity-head {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-3);
      }

      .entity-head uui-select {
        width: auto;
        min-width: 12em;
      }

      .entity-head uui-button:last-child {
        margin-left: auto;
      }

      .entity-type {
        font-weight: 600;
      }

      .entity-add {
        display: flex;
        flex-wrap: wrap;
        gap: var(--uui-size-space-2);
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-3);
      }

      .list-row {
        display: flex;
        gap: var(--uui-size-space-3);
        align-items: flex-start;
      }

      .list-member {
        flex: 1;
        min-width: 0;
      }

      .list-actions {
        display: flex;
        gap: var(--uui-size-space-1);
        flex-shrink: 0;
      }
    `,
  ];
}

export default KobenStructuredDataEntityFormElement;

declare global {
  interface HTMLElementTagNameMap {
    "koben-sd-entity-form": KobenStructuredDataEntityFormElement;
  }
}
