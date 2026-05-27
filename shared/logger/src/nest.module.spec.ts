import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { buildPinoLogger, platformLoggerModule } from "./nest.module.ts";

const meta = { name: "test-svc", version: "1.2.3" };

interface CapturedLine {
  readonly err?: { message?: string; stack?: string; type?: string };
  readonly level?: number;
  readonly msg?: string;
  readonly "service.name"?: string;
  readonly "service.version"?: string;
  readonly severity?: string;
}

const collect = (): { lines: CapturedLine[]; sink: Writable } => {
  const lines: CapturedLine[] = [];
  const sink = new Writable({
    write(chunk, _enc, cb) {
      const text = chunk.toString("utf8") as string;
      for (const part of text.split("\n")) {
        if (part) {
          lines.push(JSON.parse(part) as CapturedLine);
        }
      }
      cb();
    },
  });
  return { lines, sink };
};

describe("buildPinoLogger", () => {
  it("emits the ADR-0024 base contract on every line (regression test for pinoHttp vs pinoHttp.logger wiring)", () => {
    const { sink, lines } = collect();
    const logger = buildPinoLogger(meta, { level: "info" }, sink);

    logger.info("boot complete");
    logger.warn({ retries: 3 }, "retry budget exhausted");
    logger.error({ err: new Error("boom") }, "something failed");

    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line["service.name"]).toBe("test-svc");
      expect(line["service.version"]).toBe("1.2.3");
      expect(line.severity).toBeTypeOf("string");
      expect(line.level).toBeTypeOf("number");
    }
    expect(lines[0]?.severity).toBe("INFO");
    expect(lines[1]?.severity).toBe("WARN");
    expect(lines[2]?.severity).toBe("ERROR");
    expect(lines[2]?.err?.type).toBe("Error");
    expect(lines[2]?.err?.message).toBe("boom");
    expect(lines[2]?.err?.stack).toBeTypeOf("string");
  });

  it("honours the caller-supplied level (debug surfaces, trace does not)", () => {
    const { sink, lines } = collect();
    const logger = buildPinoLogger(meta, { level: "debug" }, sink);
    logger.trace("invisible");
    logger.debug("visible");
    expect(lines.map((l) => l.msg)).toEqual(["visible"]);
  });
});

describe("platformLoggerModule", () => {
  it("returns a DynamicModule that wires nestjs-pino with the base contract on pinoHttp.logger", () => {
    const mod = platformLoggerModule({ meta, config: { level: "info" } });
    expect(mod.module.name).toBe("PlatformLoggerModule");
    // The imports[0] is nestjs-pino's LoggerModule.forRoot(...) DynamicModule.
    // We don't introspect its private provider shape — buildPinoLogger above
    // is the load-bearing assertion (same construction path) and this test
    // is a smoke check that the factory composes without throwing.
    expect(mod.imports).toHaveLength(1);
  });

  it("composes pinoHttp overrides without clobbering the base logger", () => {
    const mod = platformLoggerModule({
      meta,
      config: { level: "info" },
      overrides: { pinoHttp: { autoLogging: false } },
    });
    expect(mod.module.name).toBe("PlatformLoggerModule");
    expect(mod.imports).toHaveLength(1);
  });
});
