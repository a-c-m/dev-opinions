import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promoteBaseline } from "../src/index.ts";
import type { Config } from "../src/types.ts";

let tmp: string;
beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "covbase-promote-"));
});
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

async function setup(
  summary: Record<string, unknown>,
  baseline: Record<string, unknown> | null
): Promise<Config> {
  const coverageFile = join(tmp, "coverage-summary.json");
  const baselineFile = join(tmp, "coverage-baseline.json");
  await writeFile(coverageFile, JSON.stringify(summary), "utf8");
  if (baseline) {
    await writeFile(baselineFile, JSON.stringify(baseline), "utf8");
  }
  return {
    baselineFile,
    coverageFile,
    epsilon: 0.1,
    thresholds: [{ branches: 80, functions: 80, glob: "src/**", lines: 80, statements: 80 }],
  };
}

const SHARED_FILE_KEY = "/repo/src/jwt.ts";
const ZERO_COV = {
  branches: { pct: 0 },
  functions: { pct: 0 },
  lines: { pct: 0 },
  statements: { pct: 0 },
};
const FULL_COV = {
  branches: { pct: 100 },
  functions: { pct: 100 },
  lines: { pct: 100 },
  statements: { pct: 100 },
};

describe("promoteBaseline() — safe mode", () => {
  it("writes the baseline when nothing regresses (ratchet-up)", async () => {
    const config = await setup(
      { [SHARED_FILE_KEY]: FULL_COV },
      {
        files: { "src/jwt.ts": { branches: 95, functions: 100, lines: 100, statements: 100 } },
        generated: "2026-01-01T00:00:00.000Z",
        schema: 1,
      }
    );
    const result = await promoteBaseline(config, "/repo");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseline.files["src/jwt.ts"].branches).toBe(100);
    }
    const written = JSON.parse(await readFile(config.baselineFile, "utf8")) as {
      files: Record<string, unknown>;
    };
    expect(written.files["src/jwt.ts"]).toEqual({
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    });
  });

  it("refuses when an existing file regresses", async () => {
    const lowCov = {
      branches: { pct: 50 },
      functions: { pct: 100 },
      lines: { pct: 100 },
      statements: { pct: 100 },
    };
    const config = await setup(
      { [SHARED_FILE_KEY]: lowCov },
      {
        files: { "src/jwt.ts": { branches: 95, functions: 100, lines: 100, statements: 100 } },
        generated: "2026-01-01T00:00:00.000Z",
        schema: 1,
      }
    );
    const result = await promoteBaseline(config, "/repo");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.drops).toHaveLength(1);
      expect(result.refusal.drops[0].metric).toBe("branches");
    }
  });

  it("refuses when a new file is below its threshold rule", async () => {
    const config = await setup(
      { "/repo/src/new.ts": ZERO_COV },
      {
        files: {},
        generated: "2026-01-01T00:00:00.000Z",
        schema: 1,
      }
    );
    const result = await promoteBaseline(config, "/repo");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.newFilesBelow.length).toBeGreaterThan(0);
    }
  });
});

describe("promoteBaseline() — allowDecrease override", () => {
  it("writes the baseline even when a file would regress", async () => {
    const lowCov = {
      branches: { pct: 50 },
      functions: { pct: 100 },
      lines: { pct: 100 },
      statements: { pct: 100 },
    };
    const config = await setup(
      { [SHARED_FILE_KEY]: lowCov },
      {
        files: { "src/jwt.ts": { branches: 95, functions: 100, lines: 100, statements: 100 } },
        generated: "2026-01-01T00:00:00.000Z",
        schema: 1,
      }
    );
    const result = await promoteBaseline(config, "/repo", { allowDecrease: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseline.files["src/jwt.ts"].branches).toBe(50);
    }
  });
});
