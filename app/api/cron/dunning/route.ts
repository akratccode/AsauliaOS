import { NextResponse } from 'next/server';
import { assertCronSecret, CronAuthError } from '@/lib/billing/cron';
import { findBrandsForDunning, runDunningForBrand } from '@/lib/billing/dunning';

export async function POST(req: Request) {
  try {
    assertCronSecret(req);
  } catch (err) {
    if (err instanceof CronAuthError) {
      return NextResponse.json({ error: err.code }, { status: 401 });
    }
    throw err;
  }

  const now = new Date();
  const brands = await findBrandsForDunning();

  const results: Array<{ brandId: string; outcome: unknown; error?: string }> = [];
  for (const brand of brands) {
    try {
      const outcome = await runDunningForBrand({ brand, now });
      results.push({ brandId: brand.id, outcome });
    } catch (err) {
      results.push({
        brandId: brand.id,
        outcome: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ processed: brands.length, results });
}

export const GET = POST;
