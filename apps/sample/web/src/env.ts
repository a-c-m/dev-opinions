import { z } from "zod";

// Read each variable individually rather than passing `import.meta.env`
// directly to safeParse. The @import-meta-env unplugin (ADR 0016) only
// transforms property-access expressions like `import.meta.env.API_URL`
// into the runtime global accessor; a bare `import.meta.env` reference
// would be statically inlined by Vite as the build-time literal and the
// runtime swap would never reach it.
const schema = z.object({
  MODE: z.enum(["development", "test", "production"]),
  API_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse({
  MODE: import.meta.env.MODE,
  API_URL: import.meta.env.API_URL,
});
if (!parsed.success) {
  throw new Error(`invalid env: ${parsed.error.message}`);
}

export const env: Env = parsed.data;
