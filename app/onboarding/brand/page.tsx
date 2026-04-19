import { BrandForm } from './brand-form';

export const metadata = { title: 'Brand setup · Asaulia' };

export default function BrandStepPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">Tell us about your brand.</h1>
        <p className="text-fg-3 text-sm">Only the essentials. You can edit everything later.</p>
      </header>
      <BrandForm />
    </section>
  );
}
