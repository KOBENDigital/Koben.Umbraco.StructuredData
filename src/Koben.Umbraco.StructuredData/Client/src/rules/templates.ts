import { getDefinition } from "../catalogue/index.js";
import type { Binding, BindingFields, RuleModel, RuleScope } from "./rules.types.js";
import { newRule } from "./rules.types.js";

/**
 * Recommended bindings per catalogue type: the shape a well-formed rule usually has. A property
 * binding with an empty alias is a slot the user fills from their own document type; the rule
 * editor shows those as "choose a property". Anything a site does not have can simply be removed,
 * since empty results are dropped when the page renders.
 */
export interface RuleTemplate {
  /** A name for the rule when created from the landing view. */
  name: string;
  scope: RuleScope;
  /** What the template assumes, shown after applying it. */
  note: string;
  fields: BindingFields;
}

const property = (alias = "", extra: Partial<Extract<Binding, { source: "property" }>> = {}): Binding => ({ source: "property", alias, ...extra });
const siteProperty = (alias = "", extra: Partial<Extract<Binding, { source: "property" }>> = {}): Binding => property(alias, { scope: "site", ...extra });
const value = (text: string): Binding => ({ source: "value", value: text });
const ref = (target: "organization" | "website" | "webpage"): Binding => ({ source: "ref", target });
const id = (target: "organization" | "website" | "webpage"): Binding => ({ source: "id", target });
const entity = (type: string, fields: BindingFields): Binding => ({ source: "entity", "@type": type, fields });

export const templates: Record<string, RuleTemplate> = {
  WebSite: {
    name: "Website",
    scope: "site",
    note: "One per site. The name is what search engines show as the site name; the URL is the site root. Reads nothing from pages, so it can stay site-wide.",
    fields: {
      "@id": id("website"),
      name: value(""),
      url: siteProperty("url"),
      publisher: ref("organization"),
    },
  },
  Organization: {
    name: "Organisation",
    scope: "site",
    note: "One per site. Name and description are fixed values; logo and contact details are read from the site root, so put those fields on the root document type and delete any row you do not have.",
    fields: {
      "@id": id("organization"),
      name: value(""),
      url: siteProperty("url"),
      logo: siteProperty(),
      description: value(""),
      telephone: siteProperty(),
      email: siteProperty(),
    },
  },
  LocalBusiness: {
    name: "Local business",
    scope: "site",
    note: "For one location, read from the site root. For several, scope the rule to a location document type and drop the site-root option on each property.",
    fields: {
      "@id": id("organization"),
      name: value(""),
      url: siteProperty("url"),
      telephone: siteProperty(),
      image: siteProperty(),
      address: entity("PostalAddress", {
        streetAddress: siteProperty(),
        addressLocality: siteProperty(),
        addressRegion: siteProperty(),
        postalCode: siteProperty(),
        addressCountry: value("AU"),
      }),
    },
  },
  WebPage: {
    name: "Web page",
    scope: "site",
    note: "Runs on every page: name, URL and dates come from the document itself. Pick your meta description and hero image properties, or remove those rows.",
    fields: {
      "@id": id("webpage"),
      name: { source: "name" },
      url: { source: "url" },
      description: property(),
      primaryImageOfPage: property(),
      datePublished: { source: "createDate" },
      dateModified: { source: "updateDate" },
      isPartOf: ref("website"),
      breadcrumb: entity("BreadcrumbList", { itemListElement: { source: "breadcrumb" } }),
    },
  },
  BreadcrumbList: {
    name: "Breadcrumb",
    scope: "site",
    note: "The trail follows the content tree from the home page to the page. Only needed on its own if you are not generating a Web page with a breadcrumb.",
    fields: {
      itemListElement: { source: "breadcrumb" },
    },
  },
  Article: {
    name: "Article",
    scope: "documentTypes",
    note: "Scope it to your article document types. Pick the headline, summary, image and author picker properties; the author is emitted as a Person named from the picked content.",
    fields: {
      headline: property(),
      description: property(),
      image: property(),
      datePublished: { source: "createDate" },
      dateModified: { source: "updateDate" },
      author: entity("Person", { name: property("", { format: "name" }), url: property("", { format: "url" }) }),
      publisher: ref("organization"),
      mainEntityOfPage: { source: "url" },
    },
  },
  Person: {
    name: "Person",
    scope: "documentTypes",
    note: "Scope it to a profile or team member document type. Name and URL come from the document; pick the job title, photo and bio properties.",
    fields: {
      name: { source: "name" },
      url: { source: "url" },
      jobTitle: property(),
      image: property(),
      description: property(),
      worksFor: ref("organization"),
    },
  },
  Service: {
    name: "Service",
    scope: "documentTypes",
    note: "Scope it to your service page document type. The provider links to the site's Organisation.",
    fields: {
      name: { source: "name" },
      url: { source: "url" },
      description: property(),
      serviceType: property(),
      image: property(),
      provider: ref("organization"),
    },
  },
  Product: {
    name: "Product",
    scope: "documentTypes",
    note: "Scope it to your product document type. Price and availability come from an Offer; set the currency once and pick the price property.",
    fields: {
      name: { source: "name" },
      description: property(),
      image: property(),
      sku: property(),
      brand: ref("organization"),
      offers: entity("Offer", {
        price: property(),
        priceCurrency: value("AUD"),
        availability: value("https://schema.org/InStock"),
        url: { source: "url" },
      }),
    },
  },
  Event: {
    name: "Event",
    scope: "documentTypes",
    note: "Scope it to your event document type. Start and end come from date properties; the organiser links to the site's Organisation.",
    fields: {
      name: { source: "name" },
      url: { source: "url" },
      description: property(),
      startDate: property(),
      endDate: property(),
      image: property(),
      organizer: ref("organization"),
    },
  },
  JobPosting: {
    name: "Job posting",
    scope: "documentTypes",
    note: "Scope it to your vacancy document type. The description should be the full listing; the closing date matters, since expired postings hurt eligibility.",
    fields: {
      title: { source: "name" },
      description: property(),
      datePosted: { source: "createDate" },
      validThrough: property(),
      hiringOrganization: ref("organization"),
      jobLocation: entity("Place", {
        address: entity("PostalAddress", { addressLocality: property(), addressRegion: property(), addressCountry: value("AU") }),
      }),
    },
  },
  ItemList: {
    name: "Item list",
    scope: "documentTypes",
    note: "Scope it to listing pages. The items are the page's published children, in tree order.",
    fields: {
      name: { source: "name" },
      itemListElement: { source: "children" },
    },
  },
};

/** Help for properties the templates add that the catalogue field list does not show. */
export const EXTRA_KEY_HELP: Record<string, string> = {
  "@id": "A stable identifier so other entities can reference this one instead of repeating it.",
  isPartOf: "The Website this page belongs to.",
  breadcrumb: "The page's position in the site, as a Breadcrumb list.",
  url: "The page's address.",
};

/** The template for a type, resolving variants (BlogPosting → Article) through the catalogue. */
export function templateFor(type: string): RuleTemplate | undefined {
  const alias = getDefinition(type)?.alias ?? type;
  return templates[alias];
}

/** The template's binding for one property, used for "Usually: …" suggestions. */
export function suggestionFor(type: string, key: string): Binding | undefined {
  return templateFor(type)?.fields[key];
}

/** A new, unsaved rule prefilled from a template. */
export function ruleFromTemplate(type: string): RuleModel {
  const rule = newRule();
  const template = templateFor(type);
  const definition = getDefinition(type);
  const emitted = definition?.typeVariants?.[0]?.value ?? definition?.alias ?? type;
  if (!template) return { ...rule, definition: { "@type": emitted, fields: {} } };
  return { ...rule, name: template.name, scope: template.scope, definition: { "@type": emitted, fields: structuredClone(template.fields) } };
}

/** Types offered as one-click starting points on the rules landing view, in the order a new site needs them. */
export const STARTER_TYPES: readonly string[] = ["WebSite", "Organization", "WebPage", "Article"];
