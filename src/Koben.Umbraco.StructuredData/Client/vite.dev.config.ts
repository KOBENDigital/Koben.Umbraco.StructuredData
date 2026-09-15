import { defineConfig } from "vite";

/**
 * A login-free harness: serves dev/index.html with the backoffice package resolved from
 * node_modules, so the editor can be exercised and screenshotted outside Umbraco. Pickers and
 * modals need the real backoffice host and are inert here.
 */
export default defineConfig({
  root: "dev",
  server: { port: 5178, strictPort: true, open: false },
  optimizeDeps: { include: ["@umbraco-cms/backoffice/external/lit", "@umbraco-cms/backoffice/external/uui"] },
});
