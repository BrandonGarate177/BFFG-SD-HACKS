import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * maplibre-gl loads its tile-decoding worker from a sibling URL
 * (/assets/maplibre-gl-worker.mjs). The bundler rewrites that reference but
 * never emits the file, so in production the worker 404s — and because the
 * SPA rewrite turns any 404 into index.html, the browser reports it as a
 * MIME-type refusal ("disallowed MIME type (text/html)") rather than a
 * missing file.
 *
 * Without the worker MapLibre cannot decode vector tiles at all: the
 * basemap renders and no parcels appear, with nothing logged by the map
 * itself.
 *
 * Copied out of node_modules at build time rather than checked into
 * public/, so it cannot drift from the installed version. Resolved by path
 * because maplibre-gl's exports map blocks require.resolve on the root.
 */
function maplibreWorker(): Plugin {
  return {
    name: "copy-maplibre-worker",
    apply: "build",
    closeBundle() {
      const src = resolve(here, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
      // maplibre-gl v5 inlines its worker into the main bundle and ships no
      // such file; only v6 emits a separate one. Skip rather than fail, so
      // this keeps working across either version.
      if (!existsSync(src)) {
        console.log("  maplibre worker is inlined in this version — nothing to copy");
        return;
      }
      const dest = resolve(here, "dist/assets/maplibre-gl-worker.mjs");
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
      console.log("  copied maplibre-gl-worker.mjs -> dist/assets/");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), maplibreWorker()],
  server: { port: 5173 },
  // No optimizeDeps.exclude for maplibre-gl. That was a v6 workaround for its
  // separate worker chunk; v5 inlines the worker, and excluding it makes Vite
  // serve the raw ESM entry — which exports only `default` — so the dev server
  // and the production bundle disagree about the module's shape.
});
