import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  USER_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  CHAT_SERVICE_URL: z.string().url().default('http://localhost:3003'),
  MESSAGE_SERVICE_URL: z.string().url().default('http://localhost:3004'),
  NOTIFICATION_SERVICE_URL: z.string().url().default('http://localhost:3005'),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }

  return result.data;
}
