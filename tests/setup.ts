import '@testing-library/jest-dom/vitest';

// Provide baseline env vars so modules that import `@/lib/env` at load time
// (like `@/lib/db`) don't explode in unit tests. Real integration tests live
// outside this vitest invocation.
const DEFAULTS: Record<string, string> = {
  DATABASE_URL: 'postgres://local:local@localhost:5432/local',
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV ?? 'test',
};
for (const [k, v] of Object.entries(DEFAULTS)) {
  if (!process.env[k]) process.env[k] = v;
}
