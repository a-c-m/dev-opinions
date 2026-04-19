import { z } from "zod";

const schema = z.object({
  MODE: z.enum(["development", "test", "production"]),
  VITE_API_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error(`invalid env: ${parsed.error.message}`);
}

export const env: Env = parsed.data;
