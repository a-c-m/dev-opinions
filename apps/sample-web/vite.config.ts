import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// ADR 0019: when BUILD_MODE=true, replace every VITE_* env reference with a
// placeholder token (`___KEY___`). The container entrypoint sed-replaces
// those tokens with real values at runtime, letting one image promote
// across environments without a rebuild.
const buildMode = process.env.BUILD_MODE === "true";

const placeholderEnv: Record<string, string> = buildMode
  ? {
      "import.meta.env.VITE_API_URL": JSON.stringify("___VITE_API_URL___"),
    }
  : {};

export default defineConfig({
  plugins: [react()],
  define: placeholderEnv,
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/main.tsx", "src/test-setup.ts"],
    },
  },
});
