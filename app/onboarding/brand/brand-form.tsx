'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createBrandAction, type OnboardingState } from '../actions';
import { FormAlert, SubmitButton } from '@/components/auth/form-primitives';
import { slugify } from '@/lib/utils/slug';

type BrandErrorCode = 'invalid_input' | 'slug_taken' | 'generic';

function detectTimezone() {
  if (typeof window === 'undefined') return 'UTC';
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function BrandForm() {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    createBrandAction,
    undefined,
  );
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone] = useState(detectTimezone);
  const t = useTranslations('onboarding.brand');
  const tFields = useTranslations('onboarding.brand.fields');
  const tErrors = useTranslations('onboarding.errors');

  function translateError(code: string | undefined): string {
    switch (code as BrandErrorCode) {
      case 'invalid_input':
        return tErrors('invalidInput');
      case 'slug_taken':
        return tErrors('slugTaken');
      case 'generic':
      default:
        return tErrors('generic');
    }
  }

  const inputClass =
    'border-fg-4/20 bg-bg-1 text-fg-1 placeholder:text-fg-4 focus:border-asaulia-blue focus:ring-asaulia-blue/30 block w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:ring-2';
  const labelClass = 'block space-y-1.5';
  const spanClass = 'text-fg-2 text-xs uppercase tracking-[0.12em]';

  return (
    <form action={formAction} className="space-y-4">
      <label className={labelClass}>
        <span className={spanClass}>{tFields('name')}</span>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        <span className={spanClass}>{tFields('slug')}</span>
        <input
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlug(slugify(e.target.value));
            setSlugTouched(true);
          }}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        <span className={spanClass}>{tFields('website')}</span>
        <input
          name="website"
          type="url"
          className={inputClass}
          placeholder={tFields('websitePlaceholder')}
        />
      </label>
      <label className={labelClass}>
        <span className={spanClass}>{tFields('timezone')}</span>
        <input name="timezone" readOnly value={timezone} className={inputClass} />
      </label>
      {state && !state.ok ? <FormAlert tone="error">{translateError(state.error)}</FormAlert> : null}
      <SubmitButton pending={pending}>{t('submit')}</SubmitButton>
    </form>
  );
}
