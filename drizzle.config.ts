import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config } from 'drizzle-kit';

// drizzle-kit runs outside Next.js, so .env.local isn't auto-loaded.
// Load it (and fall back to .env) before importing anything that reads env.
for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.',
  );
}

export default {
  schema: './lib/db/schema/*.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
} satisfies Config;
