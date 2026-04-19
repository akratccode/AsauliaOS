import { getTranslations } from 'next-intl/server';
import { PaymentForm } from './payment-form';

export async function generateMetadata() {
  const t = await getTranslations('onboarding.payment');
  return { title: t('metadata') };
}

export default async function PaymentStepPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const t = await getTranslations('onboarding.payment');
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">{t('title')}</h1>
        <p className="text-fg-3 text-sm">{t('subtitle')}</p>
      </header>
      <PaymentForm searchParams={searchParams} />
    </section>
  );
}
