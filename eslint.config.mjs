import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import i18next from 'eslint-plugin-i18next';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  i18next.configs['flat/recommended'],
  {
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          mode: 'jsx-text-only',
          'jsx-attributes': {
            include: ['placeholder', 'title', 'alt', 'aria-label', 'aria-description', 'label'],
          },
          callees: { exclude: ['t', 'translate', 'i18n', 'useTranslations', 'getTranslations'] },
          words: { exclude: ['[0-9!-/:-@[-`{-~]+', '[A-Z_-]+'] },
        },
      ],
    },
  },
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      'tests/**',
      'scripts/**',
      'lib/db/**',
      'lib/env.ts',
      'i18n/**',
      'messages/**',
      'next.config.ts',
      'drizzle.config.ts',
      '*.config.{ts,mjs,js}',
      'design-system/**',
      'app/(marketing)/**',
      'app/page.tsx',
    ],
    rules: { 'i18next/no-literal-string': 'off' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'design-system/**',
    'lib/db/migrations/**',
    'node_modules/**',
  ]),
]);

export default eslintConfig;
