import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.TABULACLEAN_BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": backendTarget,
      "/health": backendTarget,
      "/play": backendTarget,
      "/static": backendTarget,
      "/docs": backendTarget,
      "/redoc": backendTarget,
      "/openapi.json": backendTarget,
      "/metadata": backendTarget,
      "/schema": backendTarget,
      "/state": backendTarget,
      "/reset": backendTarget,
      "/step": backendTarget,
      "/mcp": backendTarget,
      "/ws": {
        target: backendTarget.replace(/^http/, "ws"),
        ws: true
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    fileParallelism: false,
    maxWorkers: 1
  }
});
