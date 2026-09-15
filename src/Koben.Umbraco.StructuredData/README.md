# Koben Structured Data for Umbraco

Schema.org structured data (JSON-LD) for Umbraco 17 and 18. Editors build entities from a guided
catalogue in the backoffice, rules generate entities from your existing content, and the package
emits the merged, resolved JSON-LD to Razor views and the Delivery API.

- **Guided editor.** FAQ, Article, Organisation, Local business, Service, Product, Event, How-to,
  Job posting, Video, Breadcrumb, Person, Website, Web page, Review, Software application, Image and
  Item list, each with the fields Google requires and recommends marked, plus a raw JSON-LD escape
  hatch for anything else. A live preview shows what the page will emit.
- **Generation rules.** Map schema.org properties to document type fields once, in Settings, and
  every matching page gets its entities at request time. Multi-site and multi-language aware.
- **Umbraco-native references.** Pick media and pages; they resolve to absolute URLs and
  `ImageObject`s at render time and drop out cleanly if unpublished or deleted.
- **Two outputs.** `StructuredDataModel` for Razor and a resolved JSON array on the Delivery API,
  including a `structuredDataGraph` property carrying every page's merged graph.

## Screenshots

![Adding an entity: the catalogue is grouped by purpose and each type says what it is for.](https://raw.githubusercontent.com/KOBENDigital/Koben.Umbraco.StructuredData/main/docs/screenshots/type-picker.png)

*Adding an entity: the catalogue is grouped by purpose and each type says what it is for.*

![Editing a Web page entity on a document: readiness badges, page and media pickers, and a JSON-LD preview.](https://raw.githubusercontent.com/KOBENDigital/Koben.Umbraco.StructuredData/main/docs/screenshots/entity-form.png)

*Editing a Web page entity on a document: readiness badges, page and media pickers, and a JSON-LD preview.*

![Generation rules in Settings: scope a rule to pages, sites and languages, then bind each schema.org property to content.](https://raw.githubusercontent.com/KOBENDigital/Koben.Umbraco.StructuredData/main/docs/screenshots/rules-manager.png)

*Generation rules in Settings: scope a rule to pages, sites and languages, then bind each schema.org property to content.*

## Requirements

| | |
|---|---|
| Umbraco | 17.0.0 or later (17 LTS and 18 are both supported by this one package) |
| .NET | 10 |

## Install

```bash
dotnet add package Koben.Umbraco.StructuredData
```

Restart the site. The package registers its property editor, a Settings-section rules manager, and
creates its one database table on first boot. No configuration is required.

## Set up the property editor

1. In the backoffice go to **Settings → Data Types → Create** and choose **Structured Data (schema.org)**.
2. Add the data type to a document type. The usual pattern is an SEO composition so every page has
   it, plus a second property on the site root for site-wide entities (Organisation, Website).

Data type settings:

| Setting | Effect |
|---|---|
| Allowed types | Restrict which catalogue types editors can add. Nothing ticked allows all. |
| Maximum entries | Cap on entries per property. Blank for no limit. |
| Allow custom JSON-LD | Offer the raw JSON-LD escape hatch. Default on. |
| Show JSON-LD preview | Offer the preview panel. Default on. |

## Render in Razor

```cshtml
@using Koben.Umbraco.StructuredData.Models
@{ var sd = Model.Value<StructuredDataModel>("structuredData"); }
@if (sd is { IsEmpty: false }) { @sd.ToScriptTags() }
```

`ToScriptTags()` writes one `<script type="application/ld+json">` per entity. `ToJsonLd()` returns
the JSON text if you need to place it yourself; `<` is escaped so a value can never close the
script element. URLs are absolute, from the site's own URL providers.

To emit the page's full merged graph (rules plus authored entries) rather than one property, inject
`IStructuredDataGraphService` and call `BuildModel(content)`; it returns the same
`StructuredDataModel`.

## Delivery API

The property serialises as an array of resolved JSON-LD objects, and every content response also
carries `structuredDataGraph` with the page's merged graph:

```json
"structuredData": [
  { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [ ] },
  { "@context": "https://schema.org", "@type": "Organization", "name": "Koben Digital",
    "logo": { "@type": "ImageObject", "url": "/media/tg3kxrue/logo.png", "width": 640, "height": 360 } }
]
```

Page and media references are site-relative here so a headless frontend makes them absolute against
its own origin. Set `Koben:StructuredData:DisableDeliveryApiGraph` to `true` to drop the
`structuredDataGraph` property.

## Generation rules

Most structured data should not be typed by hand. Under **Settings → Advanced → Structured data**
a rule has a scope (every page, or particular document types), a schema type, and field bindings
that say where each schema.org property gets its value: a page property (with dot paths into picked
content and fallbacks), a fixed value with per-language overrides, an Umbraco dictionary item, the
page's own URL, name or dates, a breadcrumb or child list, a reference to the site's Organisation or
Website node, or a nested entity. Rules can be limited to specific sites and languages.

Precedence on a page is site-wide rules, then document type rules, then entries authored on the site
root, then the page's own entries. A later node replaces an earlier one of the same `@type`, so an
editor can always override a rule on one page by authoring that type.

Rules can be exported and imported from the UI. To seed a fresh environment, point
`Koben:StructuredData:SeedFile` at an export file; an install with no rules loads it on startup.

## Configuration

| Key (appsettings) | Default | Effect |
|---|---|---|
| `Koben:StructuredData:DisableDeliveryApiGraph` | `false` | Omit `structuredDataGraph` from Delivery API responses |
| `Koben:StructuredData:SeedFile` | none | Path to a rules export loaded on startup when no rules exist |

## Links

- Source, issues and full documentation: https://github.com/KOBENDigital/Koben.Umbraco.StructuredData
- Licence: MIT. Copyright (c) 2026 Koben Digital.
