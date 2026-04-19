import type { NormalizedSale, SalesAdapter } from '../types';

type ManualConfig = {
  brandId: string;
};

export const manualAdapter: SalesAdapter = {
  provider: 'manual',

  async connect(input) {
    return {
      externalAccountId: `manual:${input.brandId}`,
      displayName: 'Manual entries',
      config: { brandId: input.brandId } satisfies ManualConfig,
    };
  },

  async pullSince(): Promise<NormalizedSale[]> {
    // Manual sales are inserted directly through the admin UI; nothing to pull.
    return [];
  },

  async disconnect() {
    // no-op
  },
};
