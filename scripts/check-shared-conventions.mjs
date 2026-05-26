#!/usr/bin/env node
// scripts/check-shared-conventions.mjs
//
// ADR 0039 gate. Walks `shared/*/package.json` and verifies the
// per-classification contract:
//
//   Runtime libs    (src/ exports any runtime value — class/function/const/...)
//     - exports.* keys carry `source` + `types` + `default`
//     - `build` script present and invokes `tsc -p tsconfig.build.json`
//     - tsconfig.build.json exists on disk
//     - standard script set: build, lint, test, test:cov, test:watch, typecheck
//
//   Pure-type libs  (src/ exports only types / interfaces / type aliases)
//     - exports points at `./src/index.ts` directly
//     - NO `build` script (nothing to emit)
//     - tsconfig.build.json MUST NOT exist
//     - standard script set: lint, test, test:cov, test:watch, typecheck
//
// Classification is determined by reading the source: any non-type
// export makes a lib runtime. A pure-type lib's first runtime export
// migrates it to the runtime shape in the same PR.
//
// Exits non-zero with a clear message when a lib violates its contract.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const sharedRoot = join(repoRoot, "shared");

const RUNTIME_SCRIPTS = ["build", "lint", "test", "test:cov", "test:watch", "typecheck"];
const PURE_TYPE_SCRIPTS = ["lint", "test", "test:cov", "test:watch", "typecheck"];

// Comment-stripping passes (run before classification regex).
const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_RE = /^\s*\/\/.*$/gm;

// Runtime-export markers. Any match means the source emits JS.
// Top-level constants per Biome's lint/performance/useTopLevelRegex.
const RUNTIME_PATTERNS = [
  /^\s*export\s+(?:async\s+)?function\s/m,
  /^\s*export\s+class\s/m,
  /^\s*export\s+(?:const|let|var)\s/m,
  /^\s*export\s+enum\s/m,
  /^\s*export\s+default\s+(?!type\b|interface\b)/m,
  /^\s*export\s+\{[^}]*\}\s+from\s/m, // value re-exports (type re-exports use `export type {`)
];

const errors = [];
const report = [];

/** @param {string} dir */
const listSourceFiles = (dir) => {
  /** @type {string[]} */
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".ts")) {
        continue;
      }
      if (entry.endsWith(".spec.ts") || entry.endsWith(".test.ts")) {
        continue;
      }
      out.push(full);
    }
  };
  walk(dir);
  return out;
};

/**
 * Classify a lib as runtime or pure-type by scanning its src/.
 * False positives → runtime classification (only costs a build step).
 * False negatives → consumer-side tsgo will fail anyway. Acceptable bias.
 *
 * @param {string} libDir
 * @returns {"runtime" | "pure-type"}
 */
const classify = (libDir) => {
  const srcDir = join(libDir, "src");
  if (!existsSync(srcDir)) {
    return "pure-type";
  }
  for (const file of listSourceFiles(srcDir)) {
    const text = readFileSync(file, "utf8");
    const stripped = text.replace(BLOCK_COMMENT_RE, "").replace(LINE_COMMENT_RE, "");
    if (RUNTIME_PATTERNS.some((pattern) => pattern.test(stripped))) {
      return "runtime";
    }
  }
  return "pure-type";
};

/**
 * Validate one entry in a runtime lib's exports map.
 *
 * @param {string} libName
 * @param {string} key
 * @param {unknown} value
 */
const checkRuntimeExportEntry = (libName, key, value) => {
  if (typeof value !== "object" || value === null) {
    errors.push(
      `${libName}: exports['${key}'] must be a conditional object with \`source\`/\`types\`/\`default\` keys (runtime lib per ADR 0039)`
    );
    return;
  }
  for (const cond of ["source", "types", "default"]) {
    if (!(cond in value)) {
      errors.push(`${libName}: exports['${key}'] missing \`${cond}\` condition key`);
    }
  }
  const source = /** @type {{source?: string}} */ (value).source;
  if (typeof source === "string" && !source.startsWith("./src/")) {
    errors.push(`${libName}: exports['${key}'].source must point into ./src/ (got '${source}')`);
  }
  const defaultPath = /** @type {{default?: string}} */ (value).default;
  if (typeof defaultPath === "string" && !defaultPath.startsWith("./dist/")) {
    errors.push(
      `${libName}: exports['${key}'].default must point into ./dist/ (got '${defaultPath}')`
    );
  }
};

/**
 * Validate one entry in a pure-type lib's exports map.
 *
 * @param {string} libName
 * @param {string} key
 * @param {unknown} value
 */
const checkPureTypeExportEntry = (libName, key, value) => {
  if (typeof value !== "string") {
    errors.push(
      `${libName}: pure-type lib must declare exports as a string pointing at ./src/index.ts, not a conditional object`
    );
    return;
  }
  if (!value.startsWith("./src/")) {
    errors.push(`${libName}: pure-type exports['${key}'] must point into ./src/ (got '${value}')`);
  }
};

/**
 * Validate the exports map shape.
 *
 * @param {string} libName
 * @param {unknown} exportsField
 * @param {"runtime" | "pure-type"} classification
 */
const checkExports = (libName, exportsField, classification) => {
  if (!exportsField || typeof exportsField !== "object") {
    errors.push(`${libName}: missing or invalid \`exports\` field`);
    return;
  }
  const entries = Object.entries(exportsField);
  if (entries.length === 0) {
    errors.push(`${libName}: \`exports\` is empty`);
    return;
  }
  const checkEntry =
    classification === "runtime" ? checkRuntimeExportEntry : checkPureTypeExportEntry;
  for (const [key, value] of entries) {
    checkEntry(libName, key, value);
  }
};

/**
 * @param {string} libName
 * @param {Record<string, string> | undefined} scripts
 * @param {"runtime" | "pure-type"} classification
 */
const checkScripts = (libName, scripts, classification) => {
  if (!scripts) {
    errors.push(`${libName}: missing \`scripts\` block (docs/conventions/scripts.md)`);
    return;
  }
  const required = classification === "runtime" ? RUNTIME_SCRIPTS : PURE_TYPE_SCRIPTS;
  for (const verb of required) {
    if (!scripts[verb]) {
      errors.push(`${libName}: missing required script '${verb}' (${classification} lib)`);
    }
  }
  if (classification === "pure-type" && scripts.build) {
    errors.push(
      `${libName}: pure-type lib MUST NOT declare a 'build' script — no runtime to emit (ADR 0039)`
    );
  }
  if (
    classification === "runtime" &&
    scripts.build &&
    !scripts.build.includes("tsconfig.build.json")
  ) {
    errors.push(
      `${libName}: runtime lib 'build' script must invoke \`tsc -p tsconfig.build.json\` (got '${scripts.build}')`
    );
  }
};

/**
 * @param {string} libDir
 * @param {string} libName
 * @param {"runtime" | "pure-type"} classification
 */
const checkTsconfigBuild = (libDir, libName, classification) => {
  const path = join(libDir, "tsconfig.build.json");
  const present = existsSync(path);
  if (classification === "runtime" && !present) {
    errors.push(
      `${libName}: missing tsconfig.build.json (runtime lib per ADR 0039 must build to dist/)`
    );
  }
  if (classification === "pure-type" && present) {
    errors.push(`${libName}: pure-type lib MUST NOT have tsconfig.build.json — nothing to emit`);
  }
};

const libDirs = readdirSync(sharedRoot)
  .map((name) => join(sharedRoot, name))
  .filter((dir) => statSync(dir).isDirectory())
  .filter((dir) => existsSync(join(dir, "package.json")));

for (const libDir of libDirs) {
  const pkgPath = join(libDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const libName = pkg.name ?? relative(repoRoot, libDir);
  const classification = classify(libDir);
  report.push(`  ${libName.padEnd(28)} ${classification}`);
  checkExports(libName, pkg.exports, classification);
  checkScripts(libName, pkg.scripts, classification);
  checkTsconfigBuild(libDir, libName, classification);
}

process.stdout.write("Shared-lib classification (ADR 0039):\n");
for (const line of report) {
  process.stdout.write(`${line}\n`);
}
process.stdout.write("\n");

if (errors.length > 0) {
  process.stderr.write("Shared-lib convention violations:\n");
  for (const err of errors) {
    process.stderr.write(`  - ${err}\n`);
  }
  process.stderr.write(
    `\n${errors.length} violation(s). See docs/adr/0039-shared-library-packaging.md and docs/conventions/scripts.md.\n`
  );
  process.exit(1);
}

process.stdout.write("All shared libs satisfy ADR 0039 + docs/conventions/scripts.md.\n");
process.exit(0);
