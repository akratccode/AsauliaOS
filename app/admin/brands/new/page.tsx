import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { ManualBrandForm } from './manual-brand-form';

export async function generateMetadata() {
  const t = await getTranslations('admin.brandNew');
  return { title: t('metadata') };
}

export default async function AdminNewBrandPage() {
  await requireAdmin();
  const t = await getTranslations('admin.brandNew');
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('portfolioLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('title')}</h1>
        <p className="text-fg-3 mt-1 text-xs">{t('subtitle')}</p>
      </header>
      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <ManualBrandForm />
      </section>
    </main>
  );
}
