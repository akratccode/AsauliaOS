import Link from 'next/link';
import { SignupForm } from './signup-form';

export const metadata = { title: 'Create account · Asaulia' };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">Start with Asaulia.</h1>
        <p className="text-fg-3 text-sm">
          {invite
            ? 'Finish setting up your invitation.'
            : 'Create your account and pick a plan on the next step.'}
        </p>
      </header>
      <SignupForm inviteToken={invite} />
      <p className="text-fg-3 text-sm">
        Already signed up?{' '}
        <Link className="text-fg-1 underline-offset-4 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </section>
  );
}
