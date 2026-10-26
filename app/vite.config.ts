import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Casca nova servida em /app pelo mesmo Worker (binding de assets em ./public). O build sai
// direto em ../public/app, de onde o Worker serve. Estrangulamento: o portal atual segue em /.
export default defineConfig({
  base: "/app/",
  plugins: [react()],
  build: {
    outDir: "../public/app",
    emptyOutDir: true,
    sourcemap: false,
  },
});
