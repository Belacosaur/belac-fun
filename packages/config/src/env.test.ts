import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseEnv } from "./env.js";

const deployed = {
  ALLOWED_ORIGINS: "https://belac.fun",
  DATABASE_URL: "postgres://db.example/belac",
  SESSION_SECRET: "test-only-secret",
  AUTH_MODE: "access",
};

describe("parseEnv", () => {
  it("rejects AUTH_MODE=local_bypass when APP_ENV=production", () => {
    expect(() =>
      parseEnv({
        ...deployed,
        APP_ENV: "production",
        AUTH_MODE: "local_bypass",
      }),
    ).toThrow(ZodError);
  });

  it("rejects ALLOW_ILLUSTRATIVE=true when APP_ENV=production", () => {
    expect(() =>
      parseEnv({
        ...deployed,
        APP_ENV: "production",
        ALLOW_ILLUSTRATIVE: "true",
      }),
    ).toThrow(ZodError);
  });

  it("rejects APP_ENV=staging without DATABASE_URL", () => {
    expect(() =>
      parseEnv({
        APP_ENV: "staging",
        ALLOWED_ORIGINS: "https://staging.belac.fun",
        SESSION_SECRET: "test-only-secret",
        AUTH_MODE: "access",
      }),
    ).toThrow(ZodError);
  });

  it("defaults ALLOW_ILLUSTRATIVE to false for local", () => {
    const env = parseEnv({
      APP_ENV: "local",
      ALLOWED_ORIGINS: "http://localhost:5173",
      AUTH_MODE: "local_bypass",
    });
    expect(env.ALLOW_ILLUSTRATIVE).toBe(false);
    expect(env.DATABASE_URL).toBeUndefined();
  });
});
