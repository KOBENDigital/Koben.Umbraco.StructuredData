# AGENTS.md — Koben.Umbraco.StructuredData

Rules for agents working in this repository. Modelled on `Koben.Umbraco.CloudflareStream/AGENTS.md`.

## What this is

An Umbraco **17+** package: a schema.org structured data (JSON-LD) property editor plus a value
converter for Razor and the Delivery API. NuGet id `Koben.Umbraco.StructuredData`, MIT.

## Frozen names

See the table at the end of `README.md`. `StructuredDataConstants` holds the C# copies and
`Client/src/constants.ts` the TypeScript ones; they must agree. Renaming any of them after a site
has stored a data type is a content-model change, not a refactor.

## The stored value is the contract

`version` / `items[] { key, type, enabled, note?, node }` with `$ref` placeholders inside `node`
(see README). The C# resolver (`Resolution/StructuredDataResolver.cs`) and the TypeScript preview
(`Client/src/jsonld.ts`) apply the same rules; change one and change the other, and extend
`Client/src/jsonld.test.ts` to match. Bump `version` only for a shape change that needs migrating.

## Adding a catalogue type

Add a `TypeDefinition` in `Client/src/catalogue/index.ts` using the helpers in `fields.ts`. Mark
fields `required` only where Google's rich-result documentation says the entity is rejected
without them, `recommended` where it says results are richer. Nested-only types set
`topLevel: false`. Nothing server-side changes: the C# side is type-agnostic.

## Rules and the graph

`Rules/StructuredDataRuleEvaluator.cs` turns a rule's bindings into a node that still carries
`$ref` placeholders; `Graph/StructuredDataGraphService.cs` layers site rules, document type rules,
site-root authored entries and page entries, then de-duplicates by `@type`. Adding a binding source
means: the evaluator's `Bind` switch, the README table, and the source options in
`Client/src/rules/binding-fields.element.ts`. The API's `scope` is the string `site` |
`documentTypes`; the DB column stores the same strings.

## Verification

- `npm run typecheck && npm test` in `Client/`, then `dotnet build`.
- The harness (`npm run dev`) renders the editor without a backoffice login; pickers and modals
  need the real backoffice and are inert there.
- End-to-end: run `test/TestSite`, create a data type on `Koben.StructuredData`, put it on a
  document type, save and publish a document, then read
  `/umbraco/delivery/api/v2/content/item/{id}` and check the `structuredData` property.

## Do not

- Commit `src/**/wwwroot/` (generated) or anything under `test/TestSite/umbraco/Data`.
- Store secrets anywhere; the package needs none.
- Use an Umbraco API that is not in 17.0.0. The package compiles against that floor
  (`UmbracoVersion` in `Directory.Packages.props`) precisely so CI catches this; bumping the floor
  drops LTS sites and is a release decision, not a convenience.
