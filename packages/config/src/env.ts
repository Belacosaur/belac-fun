import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

const allowIllustrative = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}, z.boolean());

export const envSchema = z
  .object({
    APP_ENV: z.enum(["local", "staging", "production"]),
    DATABASE_URL: optionalText,
    ALLOWED_ORIGINS: z.string(),
    PORT: optionalText,
    SESSION_SECRET: optionalText,
    SOLANA_RPC_URL: optionalText,
    PRICE_API_BASE: optionalText,
    R2_ACCOUNT_ID: optionalText,
    R2_ACCESS_KEY_ID: optionalText,
    R2_SECRET_ACCESS_KEY: optionalText,
    R2_BUCKET: optionalText,
    AUTH_MODE: z.enum(["access", "local_bypass"]),
    ALLOW_ILLUSTRATIVE: allowIllustrative,
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "local" && env.DATABASE_URL === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required outside local",
      });
    }
    if (env.APP_ENV !== "local" && env.SESSION_SECRET === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SESSION_SECRET"],
        message: "SESSION_SECRET is required outside local",
      });
    }
    if (env.APP_ENV === "production" && env.AUTH_MODE === "local_bypass") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_MODE"],
        message: "local_bypass is not allowed in production",
      });
    }
    if (env.APP_ENV === "production" && env.ALLOW_ILLUSTRATIVE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ALLOW_ILLUSTRATIVE"],
        message: "illustrative data is not allowed in production",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(input);
}
