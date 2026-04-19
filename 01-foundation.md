# Phase 01 — Foundation & Tooling

## Objective
Stand up an empty Next.js 14 app with every tool in our stack configured, a green CI pipeline, and a deployable "Hello Asaulia" page.

## Depends on
Nothing. This is the first phase.

## Unlocks
Every subsequent phase depends on this one being solid.

---

## Tasks

### 1. Initialize the project

- [ ] Run `pnpm create next-app@latest asaulia-platform --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*"`.
- [ ] `cd asaulia-platform`.
- [ ] Commit initial state: `git init && git add . && git commit -m "feat(phase-01): initial Next.js scaffold"`.
- [ ] Verify `pnpm dev` renders the default page at `http://localhost:3000`.

### 2. Configure TypeScript strictly

- [ ] In `tsconfig.json`, set `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"noFallthroughCasesInSwitch": true`.
- [ ] Add `"moduleResolution": "bundler"` if not present.

### 3. Install and configure shadcn/ui

- [ ] `pnpm dlx shadcn@latest init` — pick Default, Slate, CSS variables: yes.
- [ ] Add baseline components: `pnpm dlx shadcn@latest add button input label card dialog dropdown-menu tabs toast sonner form`.

### 4. Install core dependencies

```bash
pnpm add @supabase/supabase-js @supabase/ssr drizzle-orm postgres zod stripe resend \
  @tanstack/react-query lucide-react date-fns \
  @sentry/nextjs posthog-js posthog-node

pnpm add -D drizzle-kit vitest @vitest/ui @testing-library/react @testing-library/jest-dom \
  jsdom @playwright/test prettier prettier-plugin-tailwindcss
```

### 5. Set up linting and formatting

- [ ] Create `.prettierrc` with the Tailwind plugin: `{ "plugins": ["prettier-plugin-tailwindcss"] }`.
- [ ] Extend ESLint config to include `"prettier"`, disable rules that conflict.
- [ ] Add scripts to `package.json`:
  ```json
  {
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint",
      "format": "prettier --write .",
      "typecheck": "tsc --noEmit",
      "test": "vitest run",
      "test:watch": "vitest",
      "test:e2e": "playwright test",
      "db:generate": "drizzle-kit generate",
      "db:push": "drizzle-kit push",
      "db:studio": "drizzle-kit studio"
    }
  }
  ```

### 6. Configure Vitest

- [ ] Create `vitest.config.ts`:
  ```ts
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';
  import path from 'path';

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      globals: true,
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
  });
  ```
- [ ] Install `@vitejs/plugin-react`: `pnpm add -D @vitejs/plugin-react`.
- [ ] Create `tests/setup.ts`:
  ```ts
  import '@testing-library/jest-dom/vitest';
  ```
- [ ] Write a sanity test `tests/unit/sanity.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  describe('sanity', () => {
    it('adds', () => { expect(1 + 1).toBe(2); });
  });
  ```
- [ ] `pnpm test` must pass.

### 7. Create the folder structure

Create empty directories with `.gitkeep` files:

```
app/(marketing)
app/(auth)
app/(client)
app/(contractor)
app/(admin)
app/api
components/ui
components/kanban
components/pricing-slider
components/charts
components/forms
lib/db/schema
lib/db/migrations
lib/auth
lib/pricing
lib/billing
lib/integrations/shopify
lib/integrations/woocommerce
lib/integrations/stripe-sales
lib/integrations/manual
lib/notifications
lib/utils
tests/unit
tests/integration
scripts
```

### 8. Environment configuration

- [ ] Create `.env.example` with every variable listed in `ARCHITECTURE.md` §Environment variables, with placeholder values or empty strings.
- [ ] Create `.env.local` from it and fill in at least the dev Supabase, dev Stripe test keys, and local `DATABASE_URL`.
- [ ] Ensure `.env*.local` is in `.gitignore` (Next.js default already covers this — verify).
- [ ] Create `lib/env.ts` that validates process.env with Zod and exports a typed `env` object:
  ```ts
  import { z } from 'zod';
  const schema = z.object({
    DATABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    // ... extend as phases add dependencies
  });
  export const env = schema.parse(process.env);
  ```
  Phases 02–12 will extend this file.

### 9. Supabase local setup

- [ ] Install the Supabase CLI: `brew install supabase/tap/supabase` (or the user's platform equivalent).
- [ ] `supabase init` at the project root.
- [ ] `supabase start` — verify it runs locally; copy the local URL and anon key to `.env.local`.
- [ ] Commit the generated `supabase/` directory.

### 10. Drizzle configuration

- [ ] Create `drizzle.config.ts`:
  ```ts
  import type { Config } from 'drizzle-kit';
  import { env } from '@/lib/env';

  export default {
    schema: './lib/db/schema/*.ts',
    out: './lib/db/migrations',
    dialect: 'postgresql',
    dbCredentials: { url: env.DATABASE_URL },
  } satisfies Config;
  ```
- [ ] Create a temporary `lib/db/schema/_placeholder.ts` so `drizzle-kit` has something to scan:
  ```ts
  // Replaced in Phase 02.
  export const _placeholder = true;
  ```
- [ ] Create `lib/db/index.ts`:
  ```ts
  import { drizzle } from 'drizzle-orm/postgres-js';
  import postgres from 'postgres';
  import { env } from '@/lib/env';

  const client = postgres(env.DATABASE_URL, { prepare: false });
  export const db = drizzle(client);
  ```

### 11. Sentry + PostHog

- [ ] Follow `pnpm dlx @sentry/wizard@latest -i nextjs` — accept defaults.
- [ ] Create `lib/analytics.ts` with a PostHog client (no-op in dev unless key is set).

### 12. Root layout & "Hello Asaulia" page

- [ ] Replace `app/page.tsx` with a minimal landing: an H1 "Asaulia" and a subtitle. No design effort — Phase 08+ handles UI.
- [ ] Confirm dark-mode classes work (Tailwind's `dark:` variants). shadcn provides a `ThemeProvider`.

### 13. GitHub Actions CI

- [ ] Create `.github/workflows/ci.yml`:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    check:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v3
          with: { version: 9 }
        - uses: actions/setup-node@v4
          with: { node-version: 20, cache: 'pnpm' }
        - run: pnpm install --frozen-lockfile
        - run: pnpm lint
        - run: pnpm typecheck
        - run: pnpm test
  ```

### 14. Deploy preview

- [ ] Link the repo to Vercel.
- [ ] Set env vars in Vercel project settings for Preview and Production environments.
- [ ] Confirm the default `app/page.tsx` renders at the preview URL.

---

## Acceptance criteria

- Running `pnpm dev` shows "Asaulia" at `localhost:3000`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all green.
- CI green on GitHub on first push.
- Vercel preview deploys successfully.
- `lib/env.ts` throws on missing required env vars (verified by running `pnpm build` with a missing var and seeing the error).

---

## Notes & gotchas

- **Supabase local vs cloud:** use local for everything in Phases 01–08. Switch to cloud for shared testing around Phase 11.
- **pnpm workspaces:** NOT needed in v1. Single app. Don't over-engineer.
- **Drizzle on edge:** we use `postgres-js` driver which is not edge-compatible. That's fine — all DB calls run on Node runtime, which is the default.
- **Do NOT install**: `next-auth`, `clerk`, `prisma`, `trpc`. These fight the chosen stack.

---

## Next phase

`02-database.md` — define the full schema with Drizzle.
