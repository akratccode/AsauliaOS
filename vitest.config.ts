import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
      'next/navigation': path.resolve(__dirname, './tests/stubs/next-navigation.ts'),
      'next/headers': path.resolve(__dirname, './tests/stubs/next-headers.ts'),
    },
  },
});
