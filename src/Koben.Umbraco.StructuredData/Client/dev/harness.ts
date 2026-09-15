import "../node_modules/@umbraco-ui/uui/dist/themes/light.css";
import "@umbraco-cms/backoffice/external/uui";
import "../src/elements/property-editor-ui.element.js";
import "../src/elements/entry-card.element.js";
import "../src/elements/entity-form.element.js";
import { createItem, type StructuredDataValue } from "../src/model.js";

const sample: StructuredDataValue = {
  version: 1,
  items: [
    createItem("FAQPage", {
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "How long does an Umbraco build take?", acceptedAnswer: { "@type": "Answer", text: "Most sites ship in 8 to 14 weeks." } },
        { "@type": "Question", name: "Do you offer support?", acceptedAnswer: { "@type": "Answer", text: "" } },
      ],
    }),
    createItem("Organization", {
      "@type": "Organization",
      name: "Koben Digital",
      url: "https://www.koben.com.au/",
      logo: { $ref: "media", key: "1272904f-fb71-48a0-9c30-8ce6cf9f745d" },
      sameAs: ["https://www.linkedin.com/company/koben-digital"],
      address: { "@type": "PostalAddress", addressLocality: "Newcastle", addressRegion: "NSW", addressCountry: "AU" },
    }),
    { ...createItem("Article", { "@type": "BlogPosting", headline: "" }), enabled: false },
  ],
};

const editor = document.getElementById("editor") as HTMLElement & { value: unknown };
editor.value = sample;
editor.addEventListener("change", () => {
  // eslint-disable-next-line no-console
  console.log("value", JSON.stringify(editor.value));
});
