import type { AttributionRule, NormalizedSale } from './types';

export type ClassifyResult = {
  attributed: boolean;
  reason: string | null;
};

function ruleLabel(rule: AttributionRule): string {
  switch (rule.type) {
    case 'all':
      return 'all';
    case 'utm_source':
      return `utm_source:${rule.values.join('|')}`;
    case 'utm_medium':
      return `utm_medium:${rule.values.join('|')}`;
    case 'utm_campaign_prefix':
      return `utm_campaign_prefix:${rule.prefix}`;
    case 'coupon':
      return `coupon:${rule.codes.join('|')}`;
    case 'landing_page_prefix':
      return `landing_page_prefix:${rule.prefix}`;
  }
}

function matchesRule(sale: NormalizedSale, rule: AttributionRule): boolean {
  const m = sale.metadata;
  switch (rule.type) {
    case 'all':
      return true;
    case 'utm_source':
      return rule.values.includes(String(m.utm_source ?? ''));
    case 'utm_medium':
      return rule.values.includes(String(m.utm_medium ?? ''));
    case 'utm_campaign_prefix':
      return typeof m.utm_campaign === 'string' && m.utm_campaign.startsWith(rule.prefix);
    case 'coupon':
      return typeof m.coupon === 'string' && rule.codes.includes(m.coupon);
    case 'landing_page_prefix':
      return typeof m.landing === 'string' && m.landing.startsWith(rule.prefix);
  }
}

export function classify(
  sale: NormalizedSale,
  rules: ReadonlyArray<AttributionRule>,
): ClassifyResult {
  for (const rule of rules) {
    if (matchesRule(sale, rule)) {
      return { attributed: true, reason: ruleLabel(rule) };
    }
  }
  return { attributed: false, reason: null };
}
