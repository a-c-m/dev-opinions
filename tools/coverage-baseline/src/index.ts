import { writeFile } from "node:fs/promises";
import { compare } from "./compare.ts";
import { readBaseline, readCoverage } from "./reader.ts";
import type { Baseline, CheckResult, Config, FileCoverage } from "./types.ts";

/**
 * Run the ratchet check. Returns a structured result; the caller decides
 * whether to exit non-zero on failure.
 */
export async function checkBaseline(config: Config, repoRoot: string): Promise<CheckResult> {
  const [current, baseline] = await Promise.all([
    readCoverage(config.coverageFile, repoRoot),
    readBaseline(config.baselineFile),
  ]);
  return compare(current, baseline, config.thresholds, config.epsilon);
}

export interface PromoteOptions {
  /**
   * If false (default), refuse to write a baseline that would lower any
   * file's metric or record a sub-threshold value for a new file.
   * Set true to override (human-only — see AGENTS.md). The CLI surfaces
   * this as `--allow-decrease` and a PreToolUse hook blocks AI from
   * passing it.
   */
  allowDecrease?: boolean;
}

export interface PromoteRefusal {
  readonly drops: CheckResult["drops"];
  readonly newFilesBelow: CheckResult["newFilesBelow"];
  readonly newFilesUngated: CheckResult["newFilesUngated"];
  readonly reason: "would-decrease";
}

export type PromoteResult =
  | { readonly baseline: Baseline; readonly ok: true }
  | { readonly ok: false; readonly refusal: PromoteRefusal };

/**
 * Regenerate the baseline from the latest coverage run.
 *
 * Safe mode (default): runs `compare()` first; refuses if it would lower
 * any file's metric or record a sub-threshold value for a new file.
 *
 * Override (`allowDecrease: true`): always writes. Human-only.
 */
export async function promoteBaseline(
  config: Config,
  repoRoot: string,
  options: PromoteOptions = {}
): Promise<PromoteResult> {
  const [current, prior] = await Promise.all([
    readCoverage(config.coverageFile, repoRoot),
    readBaseline(config.baselineFile),
  ]);

  if (!options.allowDecrease) {
    const result = compare(current, prior, config.thresholds, config.epsilon);
    if (!result.ok) {
      return {
        ok: false,
        refusal: {
          drops: result.drops,
          newFilesBelow: result.newFilesBelow,
          newFilesUngated: result.newFilesUngated,
          reason: "would-decrease",
        },
      };
    }
  }

  const files: Record<string, FileCoverage> = {};
  for (const key of Object.keys(current).sort()) {
    files[key] = current[key];
  }
  const baseline: Baseline = {
    files,
    generated: new Date().toISOString(),
    schema: 1,
  };
  await writeFile(config.baselineFile, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  return { baseline, ok: true };
}

// biome-ignore lint/performance/noBarrelFile: public API of a library designed for npm extraction; the index entry IS the contract.
export { compare, matchRule } from "./compare.ts";
export type {
  Baseline,
  CheckResult,
  Config,
  Drop,
  FileCoverage,
  Metric,
  NewFileBelow,
  NewFileUngated,
  ThresholdRule,
} from "./types.ts";
