# Koben.Umbraco.StructuredData

Schema.org structured data (JSON-LD) editor for the Umbraco 18+ backoffice, with a value converter
that serves resolved JSON-LD to Razor views and to the Delivery API.

Editors add entities from a catalogue (FAQ, Article, Organisation, Local business, Service, Product,
Event, How-to, Job posting, Video, Breadcrumb, Person, Website, Web page, Review, Software
application, Image, Item list) through a form that knows which fields Google requires and
recommends, or paste raw JSON-LD for anything the catalogue does not cover. A live preview shows what
the page will emit.

## Requirements

- Umbraco **18.0.2** or later, on .NET **10**
- Node 22+ and npm 10+ to build the backoffice bundle

## Install

```bash
dotnet add package Koben.Umbraco.StructuredData
```

Then in the backoffice: **Settings → Data Types → Create**, choose **Structured Data (schema.org)**,
and add the data type to a document type. The property is normally placed on an SEO composition so
every page gets it, and once more on the site root for site-wide entities (Organisation, Website).

### Data type settings

| Setting | Effect |
|---|---|
| Allowed types | Restrict which catalogue types editors can add. Nothing ticked allows all. |
| Maximum entries | Cap on entries per property. Blank for no limit. |
| Allow custom JSON-LD | Offer the raw JSON-LD escape hatch. Default on. |
| Show JSON-LD preview | Offer the preview panel. Default on. |

## What is stored

The property value is an authoring document, not the final JSON-LD:

```json
{
  "version": 1,
  "items": [
    {
      "key": "5e1c…",
      "type": "FAQPage",
      "enabled": true,
      "node": {
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": "…", "acceptedAnswer": { "@type": "Answer", "text": "…" } }
        ]
      }
    }
  ]
}
```

Each `node` is JSON-LD shaped, with two placeholder forms for Umbraco items:

| Placeholder | Resolves to |
|---|---|
| `{ "$ref": "media", "key": "<guid>" }` | `{ "@type": "ImageObject", "url": …, "width": …, "height": … }` |
| `{ "$ref": "media", "key": "<guid>", "as": "url" }` | the media URL as a string |
| `{ "$ref": "document", "key": "<guid>" }` | the document's URL as a string |

## What is published

The value converter resolves every enabled entry at read time: placeholders become URLs or
`ImageObject`s, blank strings, empty arrays and entities holding nothing but their `@type` are
dropped, a reference to deleted or unpublished content is dropped rather than emitted, and each node
gains `"@context": "https://schema.org"` as its first member. Disabled entries and entries without an
`@type` are never emitted. The server also refuses to **publish** a document whose entries lack an
`@type` (saving a draft is still allowed, as with any invalid property).

### Razor

The property converts to `StructuredDataModel`:

```cshtml
@using Koben.Umbraco.StructuredData.Models
@{ var sd = Model.Value<StructuredDataModel>("structuredData"); }
@if (sd is { IsEmpty: false }) { @sd.ToScriptTags() }
```

`ToJsonLd(indented: false)` returns the JSON text (`<` is escaped so a value can never close the
script element). URLs are absolute, from the site's own URL providers.

### Delivery API

The property is an array of resolved JSON-LD objects:

```json
"structuredData": [
  { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [ … ] },
  { "@context": "https://schema.org", "@type": "Organization", "name": "…", "logo": { "@type": "ImageObject", "url": "/media/…/logo.png", "width": 640, "height": 360 } }
]
```

Document references are the Delivery API route path and media references its media URL, both
site-relative, so a headless frontend makes them absolute against its own origin.

## Generation rules (Settings → Advanced → Structured data)

Most structured data should not be typed by hand. Rules generate entities from a page's own
fields at request time, and the editor above is for the exceptions. A rule has:

- a **scope**: every page, or a list of document type aliases;
- a **schema type** (any catalogue type, or a custom `@type`);
- **field bindings**: where each schema.org property gets its value.

Binding sources:

| `source` | Produces |
|---|---|
| `property` | The page's `alias` (dot paths walk into picked content: `author.name`, `author.image`); `fallbackAliases` tried in order; `scope: "site"` reads the site root instead; `format: "name"` turns picked content into names, `"url"` into bare URLs |
| `value` | A literal JSON value; `cultureValues: { "fr-FR": … }` overrides it per language |
| `dictionary` | An Umbraco dictionary item by `key`, in the request culture, default language as fallback |
| `url` / `name` / `createDate` / `updateDate` | The page's own |
| `breadcrumb` | `ListItem[]` from the root down to the page |
| `children` | `ListItem[]` of published child pages |
| `ref` | `{ "@id": "<site>/#organization" }` for `target` organization, website or webpage |
| `id` | The same identifier as a string, for the node's own `@id` |
| `entity` | A nested object with its own `@type` and `fields` |
| `list` | An array of the bindings in `items` |

Picked media become `ImageObject`s, picked pages become URLs, dates become ISO 8601, rich text is
flattened to text, and empty results are dropped, so a rule can bind optimistically.

**Multi-site and multi-language.** A rule can be limited to **sites** (root nodes, picked from
the list of roots with their hostnames; matched by key, then by name so an export applied to
another environment still finds its site) and to **languages** (culture ISO codes). Both filters are
optional and hidden when the install has only one site or one language. Values follow the language
being served: property bindings read the requested culture, page names and URLs come from that
culture (invariant content falls back to its one URL), a `Fixed value` can carry per-language
overrides (`cultureValues`), and the `dictionary` source reads an Umbraco dictionary item with the
default language as fallback. Entries authored in the page editor need none of this: mark the
property "vary by culture" on the document type and Umbraco gives editors one value per language.

**Precedence on a page**: site-wide rules → document type rules → entries authored on the site
root → the page's own entries. A later node replaces an earlier one of the same `@type` (any
organisation-like type counts as "the organisation"), so an editor can always override a rule on
one page by authoring that type.

Every page's merged graph is exposed:

- Delivery API: the `structuredDataGraph` property on every content response (disable with
  `Koben:StructuredData:DisableDeliveryApiGraph`).
- Razor: `IStructuredDataGraphService.BuildModel(content)` → `StructuredDataModel.ToScriptTags()`.
- Management API: `GET /umbraco/management/api/v1/structured-data/graph/{documentId}` (Settings access).

Rules live in the `kobenStructuredDataRule` table (created by the package's migration on first
boot). Move them between environments with **Copy export** / **Import** in the UI, or set
`Koben:StructuredData:SeedFile` to an export file path: an environment with no rules loads it on
startup.

## Layout

| Path | What it is |
|---|---|
| `src/Koben.Umbraco.StructuredData/` | The package — a Razor class library serving its bundle from `App_Plugins/Koben.StructuredData` |
| `src/Koben.Umbraco.StructuredData/Client/` | TypeScript sources (Lit), built by Vite into the RCL's `wwwroot/` (generated, git-ignored) |
| `src/Koben.Umbraco.StructuredData/Client/src/catalogue/` | The schema.org catalogue: one definition per type, fields marked required/recommended |
| `src/Koben.Umbraco.StructuredData/Client/src/rules/` | The Settings-section rules manager (workspace, editor, binding fields, API client) |
| `src/Koben.Umbraco.StructuredData/Rules/`, `Graph/`, `Persistence/` | Rule model and evaluator, graph assembly and merge, NPoco storage and migration |
| `src/Koben.Umbraco.StructuredData/Client/dev/` | A login-free harness (`npm run dev`) that renders the editor outside Umbraco |
| `test/TestSite/` | A local Umbraco 18 site on SQLite with the package project-referenced |

## Building

```bash
dotnet build            # also runs npm ci / npm run build for the bundle
dotnet pack src/Koben.Umbraco.StructuredData -c Release -o artifacts
```

To pack after a client change, build the client first and skip the in-build npm step:

```bash
cd src/Koben.Umbraco.StructuredData/Client && npm run build && cd ../../..
dotnet pack src/Koben.Umbraco.StructuredData -c Release -o artifacts -p:SkipClientBuild=true
```

MSBuild globs `wwwroot/` when the project is evaluated, before any target runs; letting `pack`
rebuild the client produces new hashed chunk names and the static web asset compression step then
fails on the names it recorded earlier.

Client checks:

```bash
cd src/Koben.Umbraco.StructuredData/Client
npm run typecheck
npm test              # Vitest: preview transform, value normalisation, completeness rules
npm run dev           # harness at http://localhost:5178
```

## Running the test site

```bash
cd test/TestSite && dotnet run
```

Open **https://localhost:44325/umbraco**. Development-only credentials are in
`appsettings.Development.json`; the site installs unattended on first boot.

## Frozen names

A data type stores the schema alias, so these are content-model surface.

| Thing | Value |
|---|---|
| NuGet package id / assembly / root namespace | `Koben.Umbraco.StructuredData` |
| Static web asset base path | `App_Plugins/Koben.StructuredData` |
| `umbraco-package.json` `id` | `Koben.StructuredData` |
| Bundle JS filename | `koben-structured-data.js` |
| **Property editor schema alias** | **`Koben.StructuredData`** |
| Property editor UI alias | `Koben.PropertyEditorUi.StructuredData` |
| Allowed-types config UI alias | `Koben.PropertyEditorUi.StructuredDataTypeList` |
