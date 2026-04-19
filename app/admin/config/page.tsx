import { getTranslations } from 'next-intl/server';
import { env } from '@/lib/env';
import { PRICING, CURRENCY } from '@/lib/pricing/constants';
import { formatCents } from '@/lib/format';

export async function generateMetadata() {
  const t = await getTranslations('admin.config');
  return { title: t('metadata') };
}

export default async function AdminConfigPage() {
  const t = await getTranslations('admin.config');
  const envChecks = [
    { key: 'DATABASE_URL', present: Boolean(env.DATABASE_URL) },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', present: Boolean(env.NEXT_PUBLIC_SUPABASE_URL) },
    {
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      present: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      present: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    },
    { key: 'NEXT_PUBLIC_APP_URL', present: Boolean(env.NEXT_PUBLIC_APP_URL) },
    { key: 'STRIPE_SECRET_KEY', present: Boolean(env.STRIPE_SECRET_KEY) },
    { key: 'STRIPE_WEBHOOK_SECRET', present: Boolean(env.STRIPE_WEBHOOK_SECRET) },
    {
      key: 'STRIPE_CONNECT_CLIENT_ID',
      present: Boolean(env.STRIPE_CONNECT_CLIENT_ID),
    },
    { key: 'RESEND_API_KEY', present: Boolean(env.RESEND_API_KEY) },
    { key: 'SHOPIFY_APP_API_KEY', present: Boolean(env.SHOPIFY_APP_API_KEY) },
    {
      key: 'INTEGRATIONS_ENCRYPTION_KEY',
      present: Boolean(env.INTEGRATIONS_ENCRYPTION_KEY),
    },
    { key: 'CRON_SECRET', present: Boolean(env.CRON_SECRET) },
    { key: 'SENTRY_DSN', present: Boolean(env.SENTRY_DSN) },
    {
      key: 'UPSTASH_REDIS_REST_URL',
      present: Boolean(env.UPSTASH_REDIS_REST_URL),
    },
  ];

  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? 'local';
  const nodeEnv = env.NODE_ENV;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('systemLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('configTitle')}</h1>
        <p className="text-fg-3 mt-1 text-xs">{t('configDesc')}</p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <InfoCard label={t('environment')} value={nodeEnv} />
        <InfoCard label={t('commit')} value={commit.slice(0, 12)} mono />
        <InfoCard label={t('currency')} value={CURRENCY} />
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">{t('pricingConstants')}</h2>
        <dl className="divide-fg-4/10 divide-y text-xs">
          <Row label={t('minFixed')} value={formatCents(PRICING.MIN_FIXED_CENTS)} />
          <Row label={t('maxFixed')} value={formatCents(PRICING.MAX_FIXED_CENTS)} />
          <Row label={t('minVariable')} value={`${PRICING.MIN_VARIABLE_BPS / 100}%`} />
          <Row label={t('maxVariable')} value={`${PRICING.MAX_VARIABLE_BPS / 100}%`} />
          <Row
            label={t('contractorShareOfFixed')}
            value={`${PRICING.CONTRACTOR_SHARE_OF_FIXED_BPS / 100}%`}
          />
          <Row
            label={t('contractorShareOfVariable')}
            value={`${PRICING.CONTRACTOR_SHARE_OF_VARIABLE_BPS / 100}%`}
          />
          <Row
            label={t('planChangeCooldown')}
            value={`${PRICING.PLAN_CHANGE_COOLDOWN_DAYS} ${t('days')}`}
          />
        </dl>
        <p className="text-fg-3 mt-3 text-xs">{t('sourceOfTruth')}</p>
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">{t('environmentKeys')}</h2>
        <ul className="grid gap-1 text-xs md:grid-cols-2">
          {envChecks.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3 py-1">
              <span className="text-fg-2 font-mono">{e.key}</span>
              <span
                className={
                  e.present
                    ? 'bg-asaulia-green/15 text-asaulia-green rounded-full px-2 py-0.5'
                    : 'bg-bg-2 text-fg-3 rounded-full px-2 py-0.5'
                }
              >
                {e.present ? t('set') : t('unset')}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-fg-3 mt-3 text-xs">{t('valuesNeverRendered')}</p>
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">{t('featureFlags')}</h2>
        <p className="text-fg-3 text-sm">{t('noFlagsYet')}</p>
      </section>
    </main>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
      <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{label}</p>
      <p className={`text-fg-1 mt-1 text-xl ${mono ? 'font-mono' : 'font-serif italic'}`}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-fg-3">{label}</dt>
      <dd className="text-fg-1 font-mono">{value}</dd>
    </div>
  );
}
