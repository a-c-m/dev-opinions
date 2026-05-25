// DevAuthProvider — header-based shim for local dev.
// Refused under NODE_ENV=production unless explicitly overridden.
// Per ADR 0027.

import type {
  AuthOutcome,
  AuthProvider,
  AuthRequest,
  DevAuthConfig,
  TokenClaims,
} from "./types.ts";

type WarnFn = (message: string) => void;

const noopWarn: WarnFn = () => {
  // No-op default; forks pass a logger via DevAuthConfig.warn.
};

const PROD_REFUSAL =
  "DevAuthProvider refused under NODE_ENV=production. Set auth.allowDevInProduction: true to override (you almost certainly should not).";

const ACTIVE_WARNING =
  "[DevAuthProvider] header-based auth shim active — accepts unsigned `x-dev-user-id` and `x-dev-roles` headers. Local dev only.";

const readHeader = (req: AuthRequest, name: string): string | null => {
  const raw = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  return typeof raw === "string" ? raw : null;
};

const parseRoles = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
};

const buildClaims = (req: AuthRequest): TokenClaims | null => {
  const userId = readHeader(req, "x-dev-user-id");
  if (!userId) {
    return null;
  }
  return { userId, roles: parseRoles(readHeader(req, "x-dev-roles")) };
};

const isProduction = (): boolean => process.env.NODE_ENV === "production";

export type DevAuthConfigWithLogger = DevAuthConfig & { warn?: WarnFn };

export class DevAuthProvider implements AuthProvider {
  constructor(config: DevAuthConfigWithLogger = {}) {
    if (isProduction() && !config.allowDevInProduction) {
      throw new Error(PROD_REFUSAL);
    }
    (config.warn ?? noopWarn)(ACTIVE_WARNING);
  }

  authenticate(req: AuthRequest): Promise<AuthOutcome> {
    const claims = buildClaims(req);
    if (!claims) {
      return Promise.resolve({ kind: "unauthenticated" });
    }
    return Promise.resolve({ kind: "authenticated", claims });
  }
}
