import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  // maplibre-gl's dedicated worker script doesn't survive esbuild's dep
  // pre-bundling (the built worker chunk 404s), which silently stalls all
  // vector-tile loading. Vite's own dev-server log names this as the fix.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
