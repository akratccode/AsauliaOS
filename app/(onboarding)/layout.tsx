import type { ReactNode } from 'react';
import { OnboardingStepper } from '@/components/onboarding/stepper';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-bg-0 text-fg-1 min-h-dvh">
      <header className="border-fg-4/10 border-b px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-fg-2 font-serif text-lg italic">Asaulia</span>
          <OnboardingStepper />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
    </div>
  );
}
