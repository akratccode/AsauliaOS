export type FinanceRegion = 'us' | 'co';

export const FINANCE_REGIONS: readonly FinanceRegion[] = ['us', 'co'] as const;

export function currencyForRegion(region: FinanceRegion): 'USD' | 'COP' {
  return region === 'co' ? 'COP' : 'USD';
}

export function regionForCurrency(currency: string): FinanceRegion {
  return currency.toUpperCase() === 'COP' ? 'co' : 'us';
}

export function isFinanceRegion(value: unknown): value is FinanceRegion {
  return value === 'us' || value === 'co';
}
