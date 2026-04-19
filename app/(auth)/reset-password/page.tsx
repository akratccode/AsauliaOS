import Link from 'next/link';
import { RequestResetForm } from './request-form';

export const metadata = { title: 'Reset password · Asaulia' };

export default function ResetPasswordPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">Reset your password.</h1>
        <p className="text-fg-3 text-sm">
          We&apos;ll email you a link to set a new one.
        </p>
      </header>
      <RequestResetForm />
      <p className="text-fg-3 text-sm">
        Back to{' '}
        <Link className="text-fg-1 underline-offset-4 hover:underline" href="/login">
          sign in
        </Link>
      </p>
    </section>
  );
}
