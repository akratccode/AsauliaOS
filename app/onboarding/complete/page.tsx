import Link from 'next/link';
import { finalizeOnboardingAction } from '../actions';
import { AutoForward } from './auto-forward';

export const metadata = { title: "You're in · Asaulia" };

export default async function OnboardingCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  await finalizeOnboardingAction(params.session_id);

  return (
    <section className="space-y-6 text-center">
      <h1 className="font-serif text-4xl italic">You&apos;re in.</h1>
      <p className="text-fg-3 text-sm">
        Taking you to your dashboard now.
      </p>
      <AutoForward />
      <Link href="/dashboard" className="text-fg-2 inline-block text-sm underline underline-offset-4">
        Skip ahead
      </Link>
    </section>
  );
}
