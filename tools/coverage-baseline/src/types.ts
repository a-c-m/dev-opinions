/**
 * Public types for `coverage-baseline`.
 *
 * The tool ratchets test-coverage percentages against a committed baseline.
 * On every check run it compares the latest coverage report (Istanbul/v8
 * `coverage-summary.json` format) against the baseline and fails when a
 * file's percentage drops below its prior value. New files (no baseline
 * entry) are gated against a glob-keyed threshold policy.
 */

export type Metric = "branches" | "functions" | "lines" | "statements";

export interface FileCoverage {
  readonly branches: number;
  readonly functions: number;
  readonly lines: number;
  readonly statements: number;
}

/**
 * Shape of the committed baseline file (`coverage-baseline.json`).
 * Percentages are 0–100. File keys are repo-relative POSIX paths.
 */
export interface Baseline {
  readonly files: Readonly<Record<string, FileCoverage>>;
  readonly generated: string;
  readonly schema: 1;
}

/**
 * Threshold policy for files NOT yet in the baseline (i.e. newly added).
 * The first matching rule wins; rules are evaluated in order.
 */
export interface ThresholdRule {
  readonly branches: number;
  readonly functions: number;
  readonly glob: string;
  readonly lines: number;
  readonly statements: number;
}

export interface Config {
  /** Path to the committed baseline. */
  readonly baselineFile: string;
  /** Path to the v8/Istanbul `coverage-summary.json` produced by the runner. */
  readonly coverageFile: string;
  /** Tolerance (percentage points) below baseline that's still considered "no drop". Default 0.1 */
  readonly epsilon?: number;
  /** Threshold rules for new files. First match wins. */
  readonly thresholds: readonly ThresholdRule[];
}

export interface Drop {
  readonly baseline: number;
  readonly current: number;
  readonly file: string;
  readonly metric: Metric;
}

export interface NewFileBelow {
  readonly current: number;
  readonly file: string;
  readonly matchedRule: string;
  readonly metric: Metric;
  readonly threshold: number;
}

export interface NewFileUngated {
  readonly file: string;
}

export interface CheckResult {
  readonly drops: readonly Drop[];
  readonly newFilesBelow: readonly NewFileBelow[];
  readonly newFilesUngated: readonly NewFileUngated[];
  readonly ok: boolean;
}

/**
 * Shape of `coverage-summary.json` (the relevant subset).
 * v8/Istanbul both produce this file; absolute file paths as top-level keys
 * plus a `total` entry that we ignore.
 */
export interface CoverageSummaryEntry {
  branches: { pct: number };
  functions: { pct: number };
  lines: { pct: number };
  statements: { pct: number };
}

export type CoverageSummary = Record<string, CoverageSummaryEntry>;
