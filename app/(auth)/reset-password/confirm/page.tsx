import { getTranslations } from 'next-intl/server';
import { ConfirmResetForm } from './confirm-form';

export async function generateMetadata() {
  const t = await getTranslations('auth.resetPassword.confirm');
  return { title: t('metadata') };
}

export default async function ConfirmResetPage() {
  const t = await getTranslations('auth.resetPassword.confirm');
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">{t('title')}</h1>
        <p className="text-fg-3 text-sm">{t('subtitle')}</p>
      </header>
      <ConfirmResetForm />
    </section>
  );
}
