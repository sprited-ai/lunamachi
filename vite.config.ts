import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  build: {
    // multi-page: the app, plus the standalone component debug page
    rollupOptions: {
      input: { main: "index.html", debug: "debug.html" },
    },
  },
});
