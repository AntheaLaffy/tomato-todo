import { defineConfig } from "vite";
const mobileHost = process.env.TAURI_DEV_HOST;
export default defineConfig({
  clearScreen: false,
  server: {
    host: mobileHost || "127.0.0.1",
    port: 1420,
    strictPort: true,
    hmr: mobileHost
      ? { protocol: "ws", host: mobileHost, port: 1421 }
      : undefined,
    proxy: { "/api": "http://127.0.0.1:4319" },
  },
  build: { target: "es2022" },
});
