// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src",
  plugins: [react()],
  resolve: {
    dedupe: ["@mantine/core", "react", "react-dom"],
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  // Dev-only: in production nginx proxies /api to KBRD-API (see
  // kbrd-os/board/kbrd/rootfs-overlay/etc/nginx/conf.d/kbrd-web.conf) —
  // `vite build` ignores this block entirely, so it's harmless there.
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8081",
        // `root: "src"` above means Vite also serves src/api/*.ts as
        // modules under the /api/... URL space (e.g. /api/workspaces.ts).
        // Without this bypass those requests would be proxied to
        // KBRD-API instead of served by Vite, and 404.
        bypass(req) {
          if (req.url?.endsWith(".ts") || req.url?.endsWith(".tsx")) {
            return req.url;
          }
        },
      },
    },
  },
});
