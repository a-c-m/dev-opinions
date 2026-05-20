import { readFileSync } from "node:fs";
import ImportMetaEnvPlugin from "@import-meta-env/unplugin";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// ADR 0019: in production the unplugin rewrites `import.meta.env.X` to a
// global accessor; the placeholder script in index.html is swapped at
// container start. In dev/build it reads `.env`, with `.env.example` as
// the allowlist + committed defaults.
//
// Vitest is excluded — tests don't exercise the runtime injection path,
// and the plugin would otherwise demand env values at config-resolve time.
const isVitest = process.env.VITEST === "true";

const ENV_KEY_LINE = /^[A-Za-z_][A-Za-z0-9_]*=/;

// Build-time guard against the two ADR 0019 footguns that fail silently:
//   1. index.html missing the runtime placeholder script
//   2. env.ts using bare `import.meta.env` (which Vite inlines as
//      built-ins only) instead of per-key property access
// Either failure means the runtime injection never reaches the browser
// and the app falls through to schema defaults at runtime.
function envInjectionGuard(examplePath: string): Plugin {
  return {
    name: "env-injection-guard",
    enforce: "post",
    apply: "build",
    generateBundle(_options, bundle) {
      const html = bundle["index.html"];
      if (!html || html.type !== "asset") {
        throw new Error("[env-injection-guard] index.html missing from bundle");
      }
      if (!String(html.source).includes("import_meta_env_placeholder")) {
        throw new Error(
          "[env-injection-guard] index.html is missing the runtime env placeholder. Add the <script> tag from ADR 0019 to <head> before the bundle script."
        );
      }

      const keys = readFileSync(examplePath, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => ENV_KEY_LINE.test(l));
      if (keys.length === 0) {
        return;
      }

      const allJs = Object.values(bundle)
        .filter((c): c is Extract<typeof c, { type: "chunk" }> => c.type === "chunk")
        .map((c) => c.code)
        .join("\n");
      if (!allJs.includes("import_meta_env")) {
        throw new Error(
          "[env-injection-guard] no reference to globalThis.import_meta_env in built JS. Read env vars via property access (`import.meta.env.KEY`), not bare `import.meta.env`."
        );
      }
    },
  };
}

export default defineConfig({
  // ADR 0019: prevent Vite from auto-inlining custom env vars. Only Vite's
  // own built-ins (MODE/BASE_URL/DEV/PROD/SSR) are statically replaced;
  // every other variable flows through the unplugin's runtime accessor.
  // Without this, any var named `VITE_*` would be silently baked into the
  // bundle by Vite, defeating the runtime swap.
  envPrefix: "__never_inline__",
  plugins: [
    react(),
    ...(isVitest
      ? []
      : [ImportMetaEnvPlugin.vite({ example: ".env.example" }), envInjectionGuard(".env.example")]),
  ],
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
