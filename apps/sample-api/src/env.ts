import { z } from "zod";

const DEFAULT_PORT = 3000;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
};

export const env = loadEnv();
