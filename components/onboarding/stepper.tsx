'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const STEPS = [
  { href: '/onboarding/brand', key: 'brand' },
  { href: '/onboarding/plan', key: 'plan' },
  { href: '/onboarding/payment', key: 'payment' },
] as const;

export function OnboardingStepper() {
  const pathname = usePathname();
  const t = useTranslations('onboarding.stepper');
  const currentIndex = STEPS.findIndex((step) => pathname?.startsWith(step.href));

  return (
    <ol className="text-fg-3 flex items-center gap-2 text-xs" aria-label={t('ariaLabel')}>
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
            <span className={active ? 'text-fg-1' : ''}>{t(step.key)}</span>
            {/* eslint-disable-next-line i18next/no-literal-string -- decorative separator */}
            {i < STEPS.length - 1 ? <span className="text-fg-4/60">·</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
