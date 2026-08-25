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
});
