import type { ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema } from '@/lib/db';
import { BrandTabs } from '@/components/admin-shell/BrandTabs';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const { brandId } = await params;
  const [brand] = await db
    .select({
      id: schema.brands.id,
      name: schema.brands.name,
      slug: schema.brands.slug,
      status: schema.brands.status,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, brandId))
    .limit(1);
  if (!brand) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <header className="space-y-1">
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Brand</p>
        <div className="flex items-center gap-3">
          <h1 className="text-fg-1 font-serif text-3xl italic">{brand.name}</h1>
          <span className="text-fg-3 font-mono text-xs">{brand.slug}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              brand.status === 'active'
                ? 'bg-asaulia-green/15 text-asaulia-green'
                : 'bg-bg-2 text-fg-2'
            }`}
          >
            {brand.status}
          </span>
        </div>
      </header>
      <BrandTabs brandId={brand.id} />
      <div>{children}</div>
    </main>
  );
}
