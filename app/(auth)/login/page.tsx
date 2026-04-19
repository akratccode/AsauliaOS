import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from './login-form';

export async function generateMetadata() {
  const t = await getTranslations('auth.login');
  return { title: t('metadata') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations('auth.login');
  const tLinks = await getTranslations('auth.links');
  const tActions = await getTranslations('auth.actions');
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">{t('title')}</h1>
        <p className="text-fg-3 text-sm">{t('subtitle')}</p>
      </header>
      <SearchParamsAware searchParams={searchParams} />
      <p className="text-fg-3 text-sm">
        {tLinks('newHere')}{' '}
        <Link className="text-fg-1 underline-offset-4 hover:underline" href="/signup">
          {tActions('createAccount')}
        </Link>
      </p>
    </section>
  );
}

async function SearchParamsAware({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm next={params.next} />;
}
