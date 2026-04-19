import Link from 'next/link';

export const metadata = { title: 'Verify your email · Asaulia' };

export default function VerifyEmailPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">Check your inbox.</h1>
        <p className="text-fg-3 text-sm">
          We sent a confirmation link to your email. Click it to finish setting up your account.
        </p>
      </header>
      <p className="text-fg-3 text-sm">
        Already confirmed?{' '}
        <Link className="text-fg-1 underline-offset-4 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </section>
  );
}
