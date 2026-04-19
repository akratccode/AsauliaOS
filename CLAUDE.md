## i18n (translations)

**Every user-visible string must go through `next-intl`.** Enforced by an ESLint rule (`i18next/no-literal-string`, `warn`) + a pre-commit hook. Hardcoded JSX text, `placeholder`, `title`, `alt`, `aria-label`, `aria-description`, or `label` is flagged.

### Architecture

- Locale is read from the `NEXT_LOCALE` cookie. Default is `es`. Supported: `es`, `en`.
- The catalogs live in `messages/en.json` and `messages/es.json`.
- `i18n/request.ts` picks the catalog per request. `next-intl/client` hydrates client components.
- TypeScript augments `IntlMessages extends typeof en.json` so key paths are validated at compile time.
- Rule is at `warn` (not `error`) until residual literals are cleaned up (brand "Asaulia", public emails, marketing/legal pages).
- `app/(marketing)/**` and `app/page.tsx` are excluded from the rule (see `eslint.config.mjs`).

### Top-level namespaces

`common`, `locale`, `forms`, `errors` (global), `auth`, `onboarding`, `nav`, `statuses`, `dashboard`, `client`, `contractor`, `admin`, `kanban`, `moduleErrors`.

Module-level server-action error codes live under `moduleErrors.<module>.<feature>.<code>` (e.g. `moduleErrors.client.billing.noActiveBrand`) to avoid colliding with the global flat `errors.*` namespace.

### When adding a new string

1. Pick or create a namespace in `messages/en.json`, add the key + English copy.
2. Mirror the key in `messages/es.json` with the Spanish copy. **Both files must have identical key paths** — `pnpm i18n:check` (CI + pre-commit) fails otherwise.
3. In React:
   - Client: `const t = useTranslations('namespace'); <p>{t('key')}</p>`
   - Server: `const t = await getTranslations('namespace');`
4. For strings returned from server actions / API responses, return a snake_case **error code** in a discriminated union and map it to a translation key on the client — never hardcode English user-facing strings in action responses.
5. ICU placeholders (`{date}`, `{count}`, `{email}`) are supported in both catalogs.

### Server-action result pattern

```ts
export type FooErrorCode = 'invalid_input' | 'not_found' | 'generic';
export type FooInfoCode = 'saved';
export type FooActionResult =
  | { ok: true; info?: FooInfoCode }
  | { ok: false; error: FooErrorCode };
```

Client form maps the code:

```tsx
{state && !state.ok ? <FormAlert tone="error">{tErrors(state.error)}</FormAlert> : null}
```

### Before opening a PR

- `pnpm typecheck` — TypeScript validates key paths.
- `pnpm i18n:check` — parity between `en` and `es`.
- `pnpm lint` — no new `i18next/no-literal-string` warnings in your diff.

Escape hatch: `// eslint-disable-next-line i18next/no-literal-string` — only when the string is genuinely not user-facing (internal log, CSS class, test fixture). Justify in the commit.

### Known residual literals (not yet translated)

- Marketing home (`app/page.tsx`) and legal pages (`app/(marketing)/legal/**`) — excluded from the rule; translate when marketing copy is finalised.
- Brand word "Asaulia" in product chrome (left as-is: it's the product name).
- Public emails (`hello@asaulia.app`, `legal@asaulia.app`).
- Stripe Connect button copy in contractor onboarding (`ConnectButton.tsx`).
- A handful of composed labels around separator dots (e.g. PricingSlider) — the separator itself triggers the lint rule even though the surrounding text is translated.
