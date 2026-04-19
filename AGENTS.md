# Contributor notes for LLMs

Read [`CLAUDE.md`](./CLAUDE.md) in full before editing code.

## Non-negotiables

- **i18n:** every user-visible string goes through `next-intl`. No hardcoded JSX text, `placeholder`, `title`, `alt`, `aria-label`. See `CLAUDE.md` § `i18n (translations)`.
- **Branch hygiene:** develop on the branch named in the task prompt. Do not push to `main`.
- **No secrets in commits.** Never commit `.env*` or credentials.
- **Use existing primitives.** Before adding a new component, check `components/` and the design-system for an existing one.
