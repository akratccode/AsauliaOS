import { PlanForm } from './plan-form';

export const metadata = { title: 'Pick your plan · Asaulia' };

export default function PlanStepPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">Choose your split.</h1>
        <p className="text-fg-3 text-sm">
          Slide between a lean fixed base and a higher fixed fee with a smaller cut of sales.
        </p>
      </header>
      <PlanForm />
    </section>
  );
}
