import { getTranslations } from 'next-intl/server';
import { PlanForm } from './plan-form';

export async function generateMetadata() {
  const t = await getTranslations('onboarding.plan');
  return { title: t('metadata') };
}

export default async function PlanStepPage() {
  const t = await getTranslations('onboarding.plan');
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">{t('title')}</h1>
        <p className="text-fg-3 text-sm">{t('subtitle')}</p>
      </header>
      <PlanForm />
    </section>
  );
}
