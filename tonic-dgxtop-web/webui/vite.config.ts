import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:9400",
      "/ws": { target: "ws://localhost:9400", ws: true },
    },
  },
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
