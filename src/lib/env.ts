import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().default(''),
  VITE_AUTH_TOKEN: z.string().optional().default(''),
  VITE_ENABLE_MSW: z.enum(['true', 'false']).default('false'),
  VITE_USER_ROLES: z.string().optional().default('')
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
}

const resolved = parsed.success
  ? parsed.data
  : { VITE_API_BASE_URL: '', VITE_AUTH_TOKEN: '', VITE_ENABLE_MSW: 'false' };

const trimmedApiBaseUrl = resolved.VITE_API_BASE_URL.trim();
const trimmedAuthToken = resolved.VITE_AUTH_TOKEN.trim();
const trimmedUserRoles = resolved.VITE_USER_ROLES.trim();

export const env = {
  apiBaseUrl: trimmedApiBaseUrl || '/api',
  authToken: trimmedAuthToken || undefined,
  enableMsw: resolved.VITE_ENABLE_MSW === 'true',
  userRoles: trimmedUserRoles || undefined
};
