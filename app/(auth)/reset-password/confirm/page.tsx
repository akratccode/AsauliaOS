import { ConfirmResetForm } from './confirm-form';

export const metadata = { title: 'Set a new password · Asaulia' };

export default function ConfirmResetPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">Choose a new password.</h1>
        <p className="text-fg-3 text-sm">
          Once saved we&apos;ll take you to sign in again.
        </p>
      </header>
      <ConfirmResetForm />
    </section>
  );
}
