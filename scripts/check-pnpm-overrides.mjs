#!/usr/bin/env node
// Validates that `package.json` `pnpm.overrides` and `pnpm-overrides.md`
// are in sync. Every entry in one must appear in the other with the same
// pinned version. Fails non-zero with a precise diff if they disagree.
//
// Wired into `lefthook.yml` pre-commit (when either file is staged) and
// `pnpm check`. See `pnpm-overrides.md` for the rationale-per-pin doc.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const md = readFileSync(resolve(root, "pnpm-overrides.md"), "utf8");

const overrides = pkg.pnpm?.overrides ?? {};

// Headings in pnpm-overrides.md are `## <name>: <version>` (with optional
// backticks around the whole). Extract them into a map.
const docs = new Map();
for (const m of md.matchAll(/^##\s+`?([^:`\s]+)\s*:\s*([^`\s]+)`?\s*$/gm)) {
  docs.set(m[1], m[2]);
}

const errors = [];
for (const [name, version] of Object.entries(overrides)) {
  if (!docs.has(name)) {
    errors.push(`MISSING from pnpm-overrides.md: "${name}: ${version}"`);
  } else if (docs.get(name) !== version) {
    errors.push(
      `VERSION MISMATCH for "${name}": package.json=${version}, pnpm-overrides.md=${docs.get(name)}`
    );
  }
}
for (const [name, version] of docs.entries()) {
  if (!(name in overrides)) {
    errors.push(`EXTRA in pnpm-overrides.md (not in package.json): "${name}: ${version}"`);
  }
}

if (errors.length > 0) {
  process.stderr.write("pnpm-overrides.md is out of sync with package.json `pnpm.overrides`:\n\n");
  for (const e of errors) {
    process.stderr.write(`  - ${e}\n`);
  }
  process.stderr.write(
    "\nUpdate both so every override has a section in pnpm-overrides.md with the same version.\n"
  );
  process.exit(1);
}
