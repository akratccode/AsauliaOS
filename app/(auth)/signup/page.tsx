import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SignupForm } from './signup-form';

export async function generateMetadata() {
  const t = await getTranslations('auth.signup');
  return { title: t('metadata') };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const t = await getTranslations('auth.signup');
  const tLinks = await getTranslations('auth.links');
  const tActions = await getTranslations('auth.actions');

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">{t('title')}</h1>
        <p className="text-fg-3 text-sm">
          {invite ? t('subtitleInvite') : t('subtitleDefault')}
        </p>
      </header>
      <SignupForm inviteToken={invite} />
      <p className="text-fg-3 text-sm">
        {tLinks('alreadySignedUp')}{' '}
        <Link className="text-fg-1 underline-offset-4 hover:underline" href="/login">
          {tActions('signIn')}
        </Link>
      </p>
    </section>
  );
}
