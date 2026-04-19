import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { RequestResetForm } from './request-form';

export async function generateMetadata() {
  const t = await getTranslations('auth.resetPassword.request');
  return { title: t('metadata') };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations('auth.resetPassword.request');
  const tLinks = await getTranslations('auth.links');
  const tActions = await getTranslations('auth.actions');
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">{t('title')}</h1>
        <p className="text-fg-3 text-sm">{t('subtitle')}</p>
      </header>
      <RequestResetForm />
      <p className="text-fg-3 text-sm">
        {tLinks('backTo')}{' '}
        <Link className="text-fg-1 underline-offset-4 hover:underline" href="/login">
          {tActions('signIn')}
        </Link>
      </p>
    </section>
  );
}
