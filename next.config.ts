import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const I18N_REQUEST_PATH = './i18n/request.ts';
const withNextIntl = createNextIntlPlugin(I18N_REQUEST_PATH);

/**
 * Security headers — report-only CSP for v1 so we don't block legitimate
 * traffic before we've measured. Flip `report-uri` to enforce once Sentry
 * collects a clean 24h of zero violations.
 */
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.posthog.com https://js.stripe.com",
  "connect-src 'self' https://*.supabase.co https://*.posthog.com https://api.stripe.com https://*.sentry.io",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join('; ');

const baseConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

// Next 16 moved Turbopack config from `experimental.turbo` to the top-level
// `turbopack` key, but next-intl@3's plugin still writes its `resolveAlias`
// for `next-intl/config` into the old location. Lift it to the new key and
// strip the deprecated one so dev stops warning and the alias actually binds.
// Remove once we upgrade to next-intl@4 (native Next 16 support).
const wrapped = withNextIntl(baseConfig) as NextConfig & {
  experimental?: { turbo?: { resolveAlias?: Record<string, string> } } & Record<string, unknown>;
};

if (wrapped.experimental && 'turbo' in wrapped.experimental) {
  const { turbo, ...restExperimental } = wrapped.experimental;
  wrapped.turbopack = { ...(wrapped.turbopack ?? {}), ...(turbo ?? {}) };
  wrapped.experimental = Object.keys(restExperimental).length > 0 ? restExperimental : undefined;
}

export default wrapped as NextConfig;
