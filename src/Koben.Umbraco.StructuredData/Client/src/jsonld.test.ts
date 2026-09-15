import { describe, expect, it } from "vitest";
import { assess, summarize } from "./completeness.js";
import { formatJsonLd, toJsonLd } from "./jsonld.js";
import { createItem, normalizeValue } from "./model.js";

describe("toJsonLd", () => {
  it("drops disabled entries, blanks and empty entities, and puts @context first", () => {
    const value = normalizeValue({
      items: [
        { key: "a", type: "FAQPage", enabled: false, node: { "@type": "FAQPage", mainEntity: [] } },
        {
          key: "b",
          type: "Organization",
          enabled: true,
          node: { "@type": "Organization", name: "  Koben ", url: "", address: { "@type": "PostalAddress" }, sameAs: ["", "https://x.example"] },
        },
      ],
    });

    const nodes = toJsonLd(value);
    expect(nodes).toHaveLength(1);
    expect(Object.keys(nodes[0]!)).toEqual(["@context", "@type", "name", "sameAs"]);
    expect(nodes[0]).toEqual({ "@context": "https://schema.org", "@type": "Organization", name: "Koben", sameAs: ["https://x.example"] });
  });

  it("resolves references through the lookup and shows placeholders otherwise", () => {
    const value = normalizeValue({
      items: [
        {
          key: "a",
          type: "Article",
          enabled: true,
          node: {
            "@type": "BlogPosting",
            headline: "Hi",
            image: [{ $ref: "media", key: "m1" }],
            mainEntityOfPage: { $ref: "document", key: "d1" },
            author: [{ "@type": "Person", name: "Sam", image: { $ref: "media", key: "m2", as: "url" } }],
          },
        },
      ],
    });

    const nodes = toJsonLd(value, (ref) => (ref.key === "m1" ? { url: "/media/a.png", width: 10, height: 5 } : ref.key === "d1" ? { url: "/blog/hi" } : undefined));
    expect(nodes[0]).toMatchObject({
      image: [{ "@type": "ImageObject", url: "/media/a.png", width: 10, height: 5 }],
      mainEntityOfPage: "/blog/hi",
      author: [{ "@type": "Person", name: "Sam", image: "(media m2)" }],
    });
  });

  it("escapes < in the formatted output", () => {
    const text = formatJsonLd([{ "@context": "https://schema.org", "@type": "Thing", name: "</script>" }]);
    expect(text).not.toContain("</script>");
    expect(text).toContain("\\u003c/script>");
  });
});

describe("normalizeValue", () => {
  it("accepts undefined, a string and a malformed object", () => {
    expect(normalizeValue(undefined).items).toEqual([]);
    expect(normalizeValue("not json").items).toEqual([]);
    expect(normalizeValue({ items: [{ nope: true }, { node: { "@type": "Thing" } }] }).items).toHaveLength(1);
    expect(normalizeValue('{"items":[{"key":"k","type":"FAQPage","node":{"@type":"FAQPage"}}]}').items[0]).toMatchObject({ key: "k", enabled: true });
  });
});

describe("assess", () => {
  it("reports required fields, nested required fields, and list minimums", () => {
    const empty = createItem("FAQPage", { "@type": "FAQPage" });
    expect(assess(empty)).toMatchObject({ level: "incomplete", missing: ["Questions"] });

    const halfDone = createItem("FAQPage", {
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "" } }],
    });
    expect(assess(halfDone).missing).toEqual(["Questions 1 › Answer"]);

    const done = createItem("FAQPage", {
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } }],
    });
    expect(assess(done).level).toBe("ready");
  });

  it("distinguishes recommended from required and honours disabled", () => {
    const article = createItem("Article", { "@type": "BlogPosting", headline: "Hi" });
    const result = assess(article);
    expect(result.level).toBe("recommended");
    expect(result.missing).toEqual([]);
    expect(result.suggested).toContain("Images");
    expect(assess({ ...article, enabled: false }).level).toBe("disabled");
  });

  it("validates custom entries only on @type", () => {
    expect(assess(createItem("custom", { "@type": "" })).level).toBe("invalid");
    expect(assess(createItem("custom", { "@type": "Thing", name: "x" })).level).toBe("ready");
  });
});

describe("summarize", () => {
  it("reads the summary key, counting lists", () => {
    expect(summarize(createItem("Organization", { "@type": "Organization", name: "Koben" }))).toBe("Koben");
    expect(summarize(createItem("FAQPage", { "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "a" }, { "@type": "Question" }] }))).toBe("1 item");
  });
});
