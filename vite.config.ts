import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        viewer: "viewer.html",
      },
      output: {
        entryFileNames: "assets/viewer.js",
        chunkFileNames: "assets/chunk-[hash].js",
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("codemirror") || id.includes("@codemirror")) return "codemirror";
            if (id.includes("react-dom") || id.includes("react")) return "react";
            if (id.includes("lucide-react")) return "icons";
            return "vendor";
          }
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) return "assets/viewer.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});

