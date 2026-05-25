import { describe, expect, it } from "vitest";
import { compare, matchRule } from "../src/compare.ts";
import type { Baseline, FileCoverage, ThresholdRule } from "../src/types.ts";

const cov = (
  branches: number,
  functions: number,
  lines: number,
  statements: number
): FileCoverage => ({ branches, functions, lines, statements });

const baseline = (files: Record<string, FileCoverage>): Baseline => ({
  files,
  generated: "2026-01-01T00:00:00.000Z",
  schema: 1,
});

const SHARED_RULE: ThresholdRule = {
  branches: 95,
  functions: 100,
  glob: "shared/**",
  lines: 100,
  statements: 100,
};

const APPS_RULE: ThresholdRule = {
  branches: 80,
  functions: 80,
  glob: "apps/**",
  lines: 80,
  statements: 80,
};

describe("compare()", () => {
  it("passes when all files meet their baseline", () => {
    const current = { "shared/auth/src/jwt.ts": cov(95, 100, 100, 100) };
    const base = baseline({ "shared/auth/src/jwt.ts": cov(95, 100, 100, 100) });
    const result = compare(current, base, []);
    expect(result.ok).toBe(true);
    expect(result.drops).toEqual([]);
  });

  it("flags a drop below baseline (any metric)", () => {
    const current = { "shared/auth/src/jwt.ts": cov(90, 100, 100, 100) };
    const base = baseline({ "shared/auth/src/jwt.ts": cov(95, 100, 100, 100) });
    const result = compare(current, base, []);
    expect(result.ok).toBe(false);
    expect(result.drops).toHaveLength(1);
    expect(result.drops[0]).toMatchObject({
      file: "shared/auth/src/jwt.ts",
      metric: "branches",
      baseline: 95,
      current: 90,
    });
  });

  it("tolerates a drop within epsilon", () => {
    const current = { "shared/auth/src/jwt.ts": cov(94.95, 100, 100, 100) };
    const base = baseline({ "shared/auth/src/jwt.ts": cov(95, 100, 100, 100) });
    const result = compare(current, base, [], 0.1);
    expect(result.ok).toBe(true);
  });

  it("flags a drop just outside epsilon", () => {
    const current = { "shared/auth/src/jwt.ts": cov(94.5, 100, 100, 100) };
    const base = baseline({ "shared/auth/src/jwt.ts": cov(95, 100, 100, 100) });
    const result = compare(current, base, [], 0.1);
    expect(result.ok).toBe(false);
  });

  it("applies the first matching threshold rule for new files", () => {
    const current = { "shared/new/src/x.ts": cov(80, 80, 80, 80) };
    const base = baseline({});
    const result = compare(current, base, [SHARED_RULE, APPS_RULE]);
    expect(result.ok).toBe(false);
    expect(result.newFilesBelow).toHaveLength(4);
    expect(result.newFilesBelow.every((n) => n.matchedRule === "shared/**")).toBe(true);
  });

  it("passes a new file that meets its threshold rule", () => {
    const current = { "shared/new/src/x.ts": cov(95, 100, 100, 100) };
    const base = baseline({});
    const result = compare(current, base, [SHARED_RULE, APPS_RULE]);
    expect(result.ok).toBe(true);
    expect(result.newFilesBelow).toEqual([]);
  });

  it("flags new files that match no rule (ungated)", () => {
    const current = { "tools/foo/src/x.ts": cov(50, 50, 50, 50) };
    const base = baseline({});
    const result = compare(current, base, [SHARED_RULE, APPS_RULE]);
    expect(result.ok).toBe(false);
    expect(result.newFilesUngated).toEqual([{ file: "tools/foo/src/x.ts" }]);
  });

  it("ignores files deleted from current (present only in baseline)", () => {
    const current = {};
    const base = baseline({ "shared/auth/src/jwt.ts": cov(95, 100, 100, 100) });
    const result = compare(current, base, []);
    expect(result.ok).toBe(true);
  });
});

describe("matchRule()", () => {
  it("returns the first matching rule in order", () => {
    const rule = matchRule("shared/auth/src/jwt.ts", [SHARED_RULE, APPS_RULE]);
    expect(rule).toBe(SHARED_RULE);
  });

  it("returns null when no rule matches", () => {
    const rule = matchRule("tools/foo/src/x.ts", [SHARED_RULE, APPS_RULE]);
    expect(rule).toBeNull();
  });
});
