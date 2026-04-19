import { describe, expect, it, vi } from 'vitest';
import { slugify, appendSlugSuffix } from '@/lib/utils/slug';

describe('slug helpers', () => {
  it('slugifies normal names', () => {
    expect(slugify('Brand One')).toBe('brand-one');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Olé')).toBe('cafe-ole');
  });

  it('collapses consecutive separators', () => {
    expect(slugify('Foo   — Bar!!')).toBe('foo-bar');
  });

  it('caps length and appends a numeric suffix that still fits', () => {
    const base = 'a'.repeat(60);
    const slug = slugify(base);
    expect(slug.length).toBeLessThanOrEqual(48);
    const withSuffix = appendSlugSuffix(slug, 12);
    expect(withSuffix.length).toBeLessThanOrEqual(48);
    expect(withSuffix).toMatch(/-12$/);
  });
});

describe('savePlanRecord atomicity (mocked)', () => {
  it('closes prior open plans then inserts the new one in a single transaction', async () => {
    const order: string[] = [];
    type FakeTx = {
      update: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
    };
    const tx: FakeTx = {
      update: vi.fn(() => {
        order.push('update');
        return { set: () => ({ where: async () => undefined }) };
      }),
      insert: vi.fn(() => {
        order.push('insert');
        return {
          values: () => ({ returning: async () => [{ id: 'plan-1' }] }),
        };
      }),
    };
    const fakeDb = { transaction: async (fn: (tx: FakeTx) => Promise<unknown>) => fn(tx) };

    vi.doMock('@/lib/db', () => ({
      db: fakeDb,
      schema: { plans: { brandId: 'bid', effectiveTo: 'eto' } },
    }));

    const { savePlanRecord } = await import('@/lib/db/plans');
    const row = await savePlanRecord({
      brandId: 'b1',
      createdByUserId: 'u1',
      fixedAmountCents: 9_900,
      variablePercentBps: 2_000,
    });

    expect(row).toMatchObject({ id: 'plan-1' });
    expect(order).toEqual(['update', 'insert']);
    vi.doUnmock('@/lib/db');
  });
});
