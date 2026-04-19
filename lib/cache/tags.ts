import type { FinanceRegion } from '@/lib/billing/region';

export const tags = {
  invoicesByRegion: (region: FinanceRegion): string => `invoices:region:${region}`,
  payoutsByRegion: (region: FinanceRegion): string => `payouts:region:${region}`,
  brandContractors: (brandId: string): string => `brand:${brandId}:contractors`,
  contractorBonuses: (userId: string): string => `contractor:${userId}:bonuses`,
  financePeriods: (region: FinanceRegion): string => `finance:periods:${region}`,
  financePeriodsAll: 'finance:periods',
};
