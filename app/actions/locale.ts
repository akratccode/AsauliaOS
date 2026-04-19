'use server';

import { revalidatePath } from 'next/cache';
import { writeLocale } from '@/lib/i18n/cookie';
import { isLocale } from '@/i18n/routing';

export async function setLocaleAction(formData: FormData): Promise<void> {
  const raw = formData.get('locale');
  if (!isLocale(raw)) return;
  await writeLocale(raw);
  revalidatePath('/', 'layout');
}
