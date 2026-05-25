import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readBaseline, readCoverage } from "../src/reader.ts";

let tmp: string;
beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "covbase-"));
});
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("readCoverage()", () => {
  it("normalises absolute paths to repo-relative POSIX form", async () => {
    const repoRoot = resolve("/repo");
    const summaryPath = join(tmp, "coverage-summary.json");
    const summary = {
      total: {
        lines: { pct: 90 },
        branches: { pct: 90 },
        functions: { pct: 90 },
        statements: { pct: 90 },
      },
      "/repo/shared/auth/src/jwt.ts": {
        lines: { pct: 100 },
        branches: { pct: 95 },
        functions: { pct: 100 },
        statements: { pct: 100 },
      },
    };
    await writeFile(summaryPath, JSON.stringify(summary), "utf8");
    const out = await readCoverage(summaryPath, repoRoot);
    expect(out).toEqual({
      "shared/auth/src/jwt.ts": { branches: 95, functions: 100, lines: 100, statements: 100 },
    });
  });

  it('drops the "total" pseudo-entry', async () => {
    const summaryPath = join(tmp, "coverage-summary.json");
    await writeFile(
      summaryPath,
      JSON.stringify({
        total: {
          lines: { pct: 90 },
          branches: { pct: 90 },
          functions: { pct: 90 },
          statements: { pct: 90 },
        },
      }),
      "utf8"
    );
    const out = await readCoverage(summaryPath, "/repo");
    expect(out).toEqual({});
  });
});

describe("readBaseline()", () => {
  it("returns an empty baseline when the file does not exist", async () => {
    const baseline = await readBaseline(join(tmp, "does-not-exist.json"));
    expect(baseline.schema).toBe(1);
    expect(baseline.files).toEqual({});
  });

  it("parses an existing baseline file", async () => {
    const baselinePath = join(tmp, "baseline.json");
    const data = {
      schema: 1,
      generated: "2026-05-25T00:00:00.000Z",
      files: {
        "shared/auth/src/jwt.ts": { branches: 95, functions: 100, lines: 100, statements: 100 },
      },
    };
    await writeFile(baselinePath, JSON.stringify(data), "utf8");
    const baseline = await readBaseline(baselinePath);
    expect(baseline.files["shared/auth/src/jwt.ts"]).toEqual({
      branches: 95,
      functions: 100,
      lines: 100,
      statements: 100,
    });
  });
});
