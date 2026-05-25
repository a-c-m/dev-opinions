import picomatch from "picomatch";
import type {
  Baseline,
  CheckResult,
  Drop,
  FileCoverage,
  Metric,
  NewFileBelow,
  NewFileUngated,
  ThresholdRule,
} from "./types.ts";

const METRICS: readonly Metric[] = ["branches", "functions", "lines", "statements"];
const DEFAULT_EPSILON = 0.1;

/**
 * Pure comparison logic. Given the current coverage state, a baseline, and a
 * threshold policy for new files, return a structured result. No I/O.
 */
export function compare(
  current: Readonly<Record<string, FileCoverage>>,
  baseline: Baseline,
  thresholds: readonly ThresholdRule[],
  epsilon: number = DEFAULT_EPSILON
): CheckResult {
  const drops: Drop[] = [];
  const newFilesBelow: NewFileBelow[] = [];
  const newFilesUngated: NewFileUngated[] = [];

  for (const [file, cov] of Object.entries(current)) {
    const prior = baseline.files[file];
    if (prior) {
      for (const metric of METRICS) {
        const baselineVal = prior[metric];
        const currentVal = cov[metric];
        if (currentVal + epsilon < baselineVal) {
          drops.push({ baseline: baselineVal, current: currentVal, file, metric });
        }
      }
      continue;
    }
    const rule = matchRule(file, thresholds);
    if (!rule) {
      newFilesUngated.push({ file });
      continue;
    }
    for (const metric of METRICS) {
      const threshold = rule[metric];
      const currentVal = cov[metric];
      if (currentVal + epsilon < threshold) {
        newFilesBelow.push({
          current: currentVal,
          file,
          matchedRule: rule.glob,
          metric,
          threshold,
        });
      }
    }
  }

  return {
    drops,
    newFilesBelow,
    newFilesUngated,
    ok: drops.length === 0 && newFilesBelow.length === 0 && newFilesUngated.length === 0,
  };
}

/** First threshold rule whose glob matches the file path; null if none. */
export function matchRule(
  file: string,
  thresholds: readonly ThresholdRule[]
): ThresholdRule | null {
  for (const rule of thresholds) {
    if (picomatch.isMatch(file, rule.glob)) {
      return rule;
    }
  }
  return null;
}
