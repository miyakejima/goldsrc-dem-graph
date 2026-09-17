import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7823,
    proxy: {
      "/api": {
        target: "http://localhost:4932",
        changeOrigin: true
      }
    }
  }
});

