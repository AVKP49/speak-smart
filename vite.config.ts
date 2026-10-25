import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the built app works from any static host path (incl. GitHub Pages).
  base: "./",
  build: {
    target: "es2020",
    assetsInlineLimit: 4096,
    reportCompressedSize: true,
  },
  server: {
    port: 5173,
  },
});
