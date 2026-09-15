import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "koben-structured-data.js",
    },
    // The RCL ships wwwroot/ as static web assets, so the bundle is written straight there.
    outDir: "../wwwroot",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      // Umbraco serves its own copy of the backoffice at runtime; bundling a second one
      // would give the package its own duplicate element registry.
      external: [/^@umbraco-cms\/backoffice/],
    },
  },
});
