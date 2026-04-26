import { z } from "zod";

// VITE_API_URL is a plain string, not z.string().url(). Under ADR 0019 the
// build emits a placeholder token like `___VITE_API_URL___` that the
// container entrypoint sed-replaces at runtime; the placeholder is not a
// valid URL until that swap happens. Validation runs in the browser after
// the swap, so a too-strict schema would fail an otherwise-correct flow.
const schema = z.object({
  MODE: z.enum(["development", "test", "production"]),
  VITE_API_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error(`invalid env: ${parsed.error.message}`);
}

export const env: Env = parsed.data;
