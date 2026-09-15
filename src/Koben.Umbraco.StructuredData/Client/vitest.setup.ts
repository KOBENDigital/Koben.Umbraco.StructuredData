// happy-dom has no attachInternals, and UUI's form-control mixin calls it in its constructor.
import "element-internals-polyfill";

// happy-dom's ValidityState carries an enumerable `element` back-reference that no browser has;
// UUI's form-control mixin copies it into the polyfill's sealed ValidityState and throws.
for (const constructor of [HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement]) {
  const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, "validity");
  if (!descriptor?.get) continue;
  const getValidity = descriptor.get;
  Object.defineProperty(constructor.prototype, "validity", {
    ...descriptor,
    get() {
      const validity = getValidity.call(this);
      const element = Object.getOwnPropertyDescriptor(validity, "element");
      if (element?.enumerable) {
        Object.defineProperty(validity, "element", { ...element, enumerable: false });
      }
      return validity;
    },
  });
}

// happy-dom defines SVGElement but not SVGAElement; Umbraco's router touches it on window clicks.
const g = globalThis as unknown as Record<string, unknown>;
if (!g.SVGAElement && typeof g.SVGElement === "function") {
  g.SVGAElement = class SVGAElement extends (g.SVGElement as new () => object) {};
}
