import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { Baseline, CoverageSummary, FileCoverage } from "./types.ts";

const EMPTY_BASELINE: Baseline = {
  files: {},
  generated: new Date(0).toISOString(),
  schema: 1,
};

/**
 * Read a v8/Istanbul `coverage-summary.json` and normalise paths to
 * repo-relative POSIX form. The `total` key is filtered out.
 */
export async function readCoverage(
  coverageFile: string,
  repoRoot: string
): Promise<Record<string, FileCoverage>> {
  const text = await readFile(coverageFile, "utf8");
  const summary = JSON.parse(text) as CoverageSummary;
  const out: Record<string, FileCoverage> = {};
  for (const [key, entry] of Object.entries(summary)) {
    if (key === "total") {
      continue;
    }
    const rel = toPosixRelative(key, repoRoot);
    out[rel] = {
      branches: entry.branches.pct,
      functions: entry.functions.pct,
      lines: entry.lines.pct,
      statements: entry.statements.pct,
    };
  }
  return out;
}

/** Read a committed baseline. If the file is missing, return an empty baseline. */
export async function readBaseline(baselineFile: string): Promise<Baseline> {
  let text: string;
  try {
    text = await readFile(baselineFile, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return EMPTY_BASELINE;
    }
    throw err;
  }
  return JSON.parse(text) as Baseline;
}

function toPosixRelative(absPath: string, repoRoot: string): string {
  const rel = relative(resolve(repoRoot), absPath);
  return rel.split(sep).join("/");
}
