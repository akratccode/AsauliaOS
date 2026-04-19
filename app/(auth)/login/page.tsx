import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in · Asaulia' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">Welcome back.</h1>
        <p className="text-fg-3 text-sm">Sign in to pick up where you left off.</p>
      </header>
      <SearchParamsAware searchParams={searchParams} />
      <p className="text-fg-3 text-sm">
        New here?{' '}
        <Link className="text-fg-1 underline-offset-4 hover:underline" href="/signup">
          Create an account
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
