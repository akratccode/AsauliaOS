import { getTranslations } from 'next-intl/server';
import { BrandForm } from './brand-form';

export async function generateMetadata() {
  const t = await getTranslations('onboarding.brand');
  return { title: t('metadata') };
}

export default async function BrandStepPage() {
  const t = await getTranslations('onboarding.brand');
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">{t('title')}</h1>
        <p className="text-fg-3 text-sm">{t('subtitle')}</p>
      </header>
      <BrandForm />
    </section>
  );
}
