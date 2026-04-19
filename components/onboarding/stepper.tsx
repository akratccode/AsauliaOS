'use client';

import { usePathname } from 'next/navigation';

const STEPS = [
  { href: '/onboarding/brand', label: 'Brand' },
  { href: '/onboarding/plan', label: 'Plan' },
  { href: '/onboarding/payment', label: 'Payment' },
];

export function OnboardingStepper() {
  const pathname = usePathname();
  const currentIndex = STEPS.findIndex((step) => pathname?.startsWith(step.href));

  return (
    <ol className="text-fg-3 flex items-center gap-2 text-xs" aria-label="Onboarding progress">
      {STEPS.map((step, i) => {
        const active = i === currentIndex;
        const done = currentIndex !== -1 && i < currentIndex;
        return (
          <li key={step.href} className="flex items-center gap-2">
            <span
              className={`flex size-5 items-center justify-center rounded-full border text-[10px] transition ${
                active
                  ? 'border-asaulia-blue bg-asaulia-blue/10 text-fg-1'
                  : done
                    ? 'border-asaulia-blue/50 bg-asaulia-blue/20 text-fg-1'
                    : 'border-fg-4/30 text-fg-3'
              }`}
            >
              {i + 1}
            </span>
            <span className={active ? 'text-fg-1' : ''}>{step.label}</span>
            {i < STEPS.length - 1 ? <span className="text-fg-4/60">·</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
