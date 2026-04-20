import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { SetPasswordForm } from './set-password-form';

export async function generateMetadata() {
  const t = await getTranslations('auth.setPassword');
  return { title: t('metadata') };
}

export default async function SetPasswordPage() {
  const ctx = await requireAuth();
  const [row] = await db
    .select({ passwordSetAt: schema.users.passwordSetAt })
    .from(schema.users)
    .where(eq(schema.users.id, ctx.userId))
    .limit(1);

  if (row?.passwordSetAt) {
    redirect('/dashboard');
  }

  const t = await getTranslations('auth.setPassword');

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl italic">{t('title')}</h1>
        <p className="text-fg-3 text-sm">{t('subtitle', { email: ctx.email })}</p>
      </header>
      <SetPasswordForm />
    </section>
  );
}
