#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { checkBaseline, promoteBaseline } from "./index.ts";
import type { CheckResult, Config } from "./types.ts";

const USAGE = `coverage-baseline — ratchet test coverage against a committed baseline

Usage:
  coverage-baseline check    [--config <path>] [--repo-root <path>]
  coverage-baseline promote  [--config <path>] [--repo-root <path>] [--allow-decrease]

Subcommands:
  check    Compare current coverage to baseline. Exits non-zero on any drop
           or new file below its threshold rule.
  promote  Regenerate the baseline from the latest coverage run.
           Safe by default — refuses to write a baseline that would lower
           any file's metric or accept a sub-threshold new file. Pass
           --allow-decrease to override (human-only; a PreToolUse hook
           blocks AI from passing this flag).

Options:
  --config           Path to coverage-baseline config (default: ./.coverage-baseline.json)
  --repo-root        Repository root for normalising file paths (default: cwd)
  --allow-decrease   (promote only) Permit writing a baseline that lowers a metric
                     or accepts a sub-threshold new file. Human-only.
  --help, -h         Show this message.

Config file shape (JSON):
  {
    "coverageFile": "coverage/coverage-summary.json",
    "baselineFile": "coverage-baseline.json",
    "thresholds": [
      { "glob": "shared/**", "lines": 100, "branches": 95, "functions": 100, "statements": 100 },
      { "glob": "apps/**",   "lines": 80,  "branches": 80, "functions": 80,  "statements": 80  }
    ],
    "epsilon": 0.1
  }
`;

interface CliArgs {
  allowDecrease: boolean;
  configPath: string;
  repoRoot: string;
  subcommand: "check" | "promote";
}

function parseArgs(argv: readonly string[]): CliArgs | null {
  const rest = argv.slice(2);
  if (rest.includes("--help") || rest.includes("-h") || rest.length === 0) {
    return null;
  }
  const subcommand = rest[0];
  if (subcommand !== "check" && subcommand !== "promote") {
    return null;
  }
  let configPath = ".coverage-baseline.json";
  let repoRoot = process.cwd();
  let allowDecrease = false;
  for (let i = 1; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--config") {
      configPath = rest[++i] ?? "";
    } else if (arg === "--repo-root") {
      repoRoot = rest[++i] ?? "";
    } else if (arg === "--allow-decrease" && subcommand === "promote") {
      allowDecrease = true;
    } else {
      return null;
    }
  }
  return { allowDecrease, configPath, repoRoot, subcommand };
}

async function loadConfig(path: string): Promise<Config> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as Config;
}

function formatPercent(n: number): string {
  return n.toFixed(1).padStart(5, " ");
}

interface CheckBody {
  readonly drops: CheckResult["drops"];
  readonly newFilesBelow: CheckResult["newFilesBelow"];
  readonly newFilesUngated: CheckResult["newFilesUngated"];
}

function reportCheckBody(result: CheckBody): void {
  if (result.drops.length > 0) {
    console.error(`\ncoverage-baseline: ${result.drops.length} file(s) dropped below baseline:\n`);
    for (const d of result.drops) {
      console.error(
        `  ${d.file}  ${d.metric.padEnd(10)}  baseline ${formatPercent(d.baseline)}%  →  ${formatPercent(d.current)}%`
      );
    }
  }
  if (result.newFilesBelow.length > 0) {
    console.error(
      `\ncoverage-baseline: ${result.newFilesBelow.length} new-file metric(s) below threshold:\n`
    );
    for (const n of result.newFilesBelow) {
      console.error(
        `  ${n.file}  ${n.metric.padEnd(10)}  rule "${n.matchedRule}" requires ${formatPercent(n.threshold)}%  →  ${formatPercent(n.current)}%`
      );
    }
  }
  if (result.newFilesUngated.length > 0) {
    console.error(
      `\ncoverage-baseline: ${result.newFilesUngated.length} new file(s) match no threshold rule (add a rule or promote the baseline):\n`
    );
    for (const n of result.newFilesUngated) {
      console.error(`  ${n.file}`);
    }
  }
}

function reportCheck(result: CheckResult): void {
  if (result.ok) {
    console.log("coverage-baseline: ok — no drops, no ungated new files.");
    return;
  }
  reportCheckBody(result);
}

async function runCheck(config: Config, repoRoot: string): Promise<number> {
  const result = await checkBaseline(config, repoRoot);
  reportCheck(result);
  return result.ok ? 0 : 1;
}

async function runPromote(
  config: Config,
  repoRoot: string,
  allowDecrease: boolean
): Promise<number> {
  const result = await promoteBaseline(config, repoRoot, { allowDecrease });
  if (result.ok) {
    console.log(
      `coverage-baseline: wrote ${Object.keys(result.baseline.files).length} entries to ${config.baselineFile}`
    );
    return 0;
  }
  console.error(
    "coverage-baseline: refused to promote — the proposed baseline would lower at least one metric or accept a sub-threshold new file."
  );
  reportCheckBody(result.refusal);
  console.error(
    "\nFix the regressions, or — if the drop is intentional — re-run with --allow-decrease (human-only)."
  );
  return 1;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv);
  if (!args) {
    console.log(USAGE);
    return 1;
  }
  const config = await loadConfig(resolve(args.configPath));
  if (args.subcommand === "check") {
    return runCheck(config, args.repoRoot);
  }
  return runPromote(config, args.repoRoot, args.allowDecrease);
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`coverage-baseline: ${(err as Error).message}`);
    process.exit(2);
  }
);
