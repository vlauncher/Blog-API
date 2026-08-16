import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),

  // Site URL for RSS/Sitemaps/Emails
  SITE_URL: z.string().url().default("http://localhost:8000"),

  // Database
  DATABASE_URL: z.string().default("file:./dev.db"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16).default("default_access_super_secret_key_change_in_production_1234567890"),
  JWT_REFRESH_SECRET: z.string().min(16).default("default_refresh_super_secret_key_change_in_production_1234567890"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // SMTP (Gmail)
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().default("noreply@example.com"),
  SMTP_PASS: z.string().default("password"),
  EMAIL_FROM: z.string().default("Blog API <noreply@example.com>"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().default("demo"),
  CLOUDINARY_API_KEY: z.string().default("demo_key"),
  CLOUDINARY_API_SECRET: z.string().default("demo_secret"),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
