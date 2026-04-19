## i18n (translations)

**Every user-visible string must go through `next-intl`.** This is enforced by an ESLint rule (`i18next/no-literal-string`) + a pre-commit hook. Hardcoded JSX text, `placeholder`, `title`, `alt`, `aria-label`, `aria-description`, or `label` will be flagged.

### When adding a new string

1. Pick or create a namespace in `messages/en.json`, add the key + English copy.
2. Mirror the key in `messages/es.json` with the Spanish copy. **Both files must have identical key paths** — `pnpm i18n:check` (CI + pre-commit) fails otherwise.
3. In React:
   - Client: `const t = useTranslations('namespace'); <p>{t('key')}</p>`
   - Server: `const t = await getTranslations('namespace');`
4. For strings returned from server actions / API responses, use `getTranslations('errors')` (or similar) — do NOT hardcode English error strings.
5. Locale is read from the `NEXT_LOCALE` cookie. Default is `es`. Supported: `es`, `en`.

### When adding a new module

Before opening the PR, run:
- `pnpm lint` — no `i18next/no-literal-string` warnings.
- `pnpm i18n:check` — parity between `en` and `es`.
- `pnpm typecheck` — TypeScript validates key paths.

Escape hatch: `// eslint-disable-next-line i18next/no-literal-string` — only when the string is genuinely not user-facing (internal log, CSS class, test fixture). Justify in the commit.
