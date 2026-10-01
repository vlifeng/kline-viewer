import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Fully static build. For GitHub Pages project sites set VITE_BASE=/<repo>/ (default "./" = relative, works anywhere).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return { base: env.VITE_BASE || "./", plugins: [react()], build: { outDir: "dist", sourcemap: false } };
});
