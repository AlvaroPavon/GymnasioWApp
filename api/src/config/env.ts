import "dotenv/config";
import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

const publicBaseUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "PUBLIC_BASE_URL must use http or https");

const mysqlDatabaseUrl = z.string().url().refine(
  (value) => new URL(value).protocol === "mysql:",
  "DATABASE_URL must use mysql"
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: mysqlDatabaseUrl,
  JWT_SECRET: z.string().min(32, "JWT_SECRET must have at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  PUBLIC_BASE_URL: publicBaseUrl.optional(),
  CRON_ENABLED: booleanFromEnv.default(true),
  ALLOW_DEMO_SEED: booleanFromEnv.default(false)
});

/** Parses and validates the process environment used by the API. */
export function parseEnv(input: NodeJS.ProcessEnv) {
  return envSchema.parse(input);
}

export const env = parseEnv(process.env);
