# i18n ESLint Rule: `i18next/no-literal-string`

This rule prevents hardcoded user-facing strings from landing in the codebase. It is part
of Phase 2 of the i18n rollout and currently runs at `warn` level. Phase 12 will flip it
to `error` once all modules have been extracted.

## What it flags

- **JSX text**: bare text inside JSX elements, e.g. `<p>Hello world</p>`.
- **JSX attributes** on the allowlist: `placeholder`, `title`, `alt`, `aria-label`,
  `aria-description`, `label`. For example, `<input placeholder="Search" />` is flagged.

Configuration lives in [`eslint.config.mjs`](../eslint.config.mjs). The rule runs in
`jsx-text-only` mode so non-JSX string literals (object keys, enum values, CSS classes,
etc.) are not flagged.

## How to fix

Use `next-intl` translations instead of a literal:

```tsx
import { useTranslations } from 'next-intl';

export function Greeting() {
  const t = useTranslations('namespace');
  return <p>{t('key')}</p>;
}
```

In server components or route handlers, use `getTranslations` from `next-intl/server`.

## Escape hatch

If a string is genuinely not user-facing (a CSS class, a test fixture, a dev-only log
message, or a constant that happens to be a word), disable the rule on that line:

```tsx
// eslint-disable-next-line i18next/no-literal-string
<div className="flex items-center">...</div>
```

Use this sparingly. If a string is visible to the user, it belongs in a message catalog.

## Source of truth

All translation keys live in the message catalogs:

- [`messages/en.json`](../messages/en.json)
- [`messages/es.json`](../messages/es.json)

Add new keys to **both** files to keep locales in sync.
