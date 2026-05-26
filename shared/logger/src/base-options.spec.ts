import { describe, expect, it } from "vitest";
import { baseLoggerOptions } from "./base-options.ts";

const meta = { name: "test-svc", version: "1.2.3" };

describe("baseLoggerOptions", () => {
  it("binds service.name and service.version on every line via `base`", () => {
    const opts = baseLoggerOptions(meta);
    expect(opts.base).toEqual({
      "service.name": "test-svc",
      "service.version": "1.2.3",
    });
  });

  it("emits a `severity` mirror of the numeric `level` (OTel SeverityText)", () => {
    const opts = baseLoggerOptions(meta);
    const formatter = opts.formatters?.level;
    if (!formatter) {
      throw new Error("level formatter not configured");
    }
    expect(formatter("info", 30)).toEqual({ level: 30, severity: "INFO" });
    expect(formatter("error", 50)).toEqual({ level: 50, severity: "ERROR" });
    expect(formatter("warn", 40)).toEqual({ level: 40, severity: "WARN" });
    expect(formatter("debug", 20)).toEqual({ level: 20, severity: "DEBUG" });
    expect(formatter("trace", 10)).toEqual({ level: 10, severity: "TRACE" });
    expect(formatter("fatal", 60)).toEqual({ level: 60, severity: "FATAL" });
  });

  it("falls back to uppercase label for unknown numeric levels", () => {
    const opts = baseLoggerOptions(meta);
    const formatter = opts.formatters?.level;
    if (!formatter) {
      throw new Error("level formatter not configured");
    }
    expect(formatter("custom", 99)).toEqual({ level: 99, severity: "CUSTOM" });
  });

  it("wires the pino stdSerializers.err on the `err` key", () => {
    const opts = baseLoggerOptions(meta);
    expect(opts.serializers?.err).toBeTypeOf("function");
    const serialised = opts.serializers?.err?.(new Error("boom")) as Record<string, unknown>;
    expect(serialised?.type).toBe("Error");
    expect(serialised?.message).toBe("boom");
    expect(serialised?.stack).toBeTypeOf("string");
  });

  it("defaults level to 'info' when config omitted", () => {
    expect(baseLoggerOptions(meta).level).toBe("info");
    expect(baseLoggerOptions(meta, {}).level).toBe("info");
  });

  it("honours the caller-supplied level", () => {
    expect(baseLoggerOptions(meta, { level: "debug" }).level).toBe("debug");
    expect(baseLoggerOptions(meta, { level: "warn" }).level).toBe("warn");
  });
});
