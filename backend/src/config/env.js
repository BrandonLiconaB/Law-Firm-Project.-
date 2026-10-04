import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  FRONTEND_ORIGIN: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) => {
        try {
          return ['postgres:', 'postgresql:'].includes(new URL(value).protocol)
        } catch {
          return false
        }
      },
      { message: 'DATABASE_URL must be a PostgreSQL connection URL.' },
    ),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  DATABASE_SSL: z.enum(['disable', 'require']).default('disable'),
  SESSION_COOKIE_NAME: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/)
    .default('gestor_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  const invalidVariables = result.error.issues
    .map((issue) => issue.path.join('.'))
    .filter(Boolean)
    .join(', ')

  throw new Error(
    `Invalid environment configuration${
      invalidVariables ? `: ${invalidVariables}` : ''
    }`,
  )
}

export const env = Object.freeze(result.data)
