import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AutoForward } from './auto-forward';

export async function generateMetadata() {
  const t = await getTranslations('onboarding.complete');
  return { title: t('metadata') };
}

export default async function OnboardingCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations('onboarding.complete');

  return (
    <section className="space-y-6 text-center">
      <h1 className="font-serif text-4xl italic">{t('title')}</h1>
      <p className="text-fg-3 text-sm">{t('subtitle')}</p>
      <AutoForward sessionId={params.session_id} />
      <Link href="/dashboard" className="text-fg-2 inline-block text-sm underline underline-offset-4">
        {t('skipLink')}
      </Link>
    </section>
  );
}
