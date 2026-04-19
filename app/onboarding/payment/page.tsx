import { PaymentForm } from './payment-form';

export const metadata = { title: 'Set up billing · Asaulia' };

export default function PaymentStepPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">Set up billing.</h1>
        <p className="text-fg-3 text-sm">
          We charge the fixed portion monthly; variable is reconciled at the close of each cycle.
        </p>
      </header>
      <PaymentForm searchParams={searchParams} />
    </section>
  );
}
