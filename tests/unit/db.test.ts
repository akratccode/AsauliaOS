import { describe, it, expect } from 'vitest';
import { schema } from '@/lib/db';

// Structural tests: verify the Drizzle schema exposes the tables and columns
// the rest of the app depends on. Integration tests against a live database
// live in tests/integration/ and are run by CI when DATABASE_URL points at a
// real Postgres.

describe('db schema surface', () => {
  it('exports every tenant table', () => {
    expect(schema.users).toBeDefined();
    expect(schema.brands).toBeDefined();
    expect(schema.brandMembers).toBeDefined();
    expect(schema.plans).toBeDefined();
    expect(schema.contractorProfiles).toBeDefined();
    expect(schema.brandContractors).toBeDefined();
    expect(schema.deliverables).toBeDefined();
    expect(schema.deliverableAttachments).toBeDefined();
    expect(schema.deliverableComments).toBeDefined();
    expect(schema.deliverableActivity).toBeDefined();
    expect(schema.salesIntegrations).toBeDefined();
    expect(schema.salesRecords).toBeDefined();
    expect(schema.invoices).toBeDefined();
    expect(schema.payouts).toBeDefined();
    expect(schema.notifications).toBeDefined();
    expect(schema.auditLog).toBeDefined();
  });

  it('plans table carries monetary columns in cents and bps', () => {
    const cols = Object.keys(schema.plans);
    expect(cols).toContain('fixedAmountCents');
    expect(cols).toContain('variablePercentBps');
    expect(cols).toContain('effectiveFrom');
  });

  it('invoices carry generated total_amount_cents plus snapshot', () => {
    const cols = Object.keys(schema.invoices);
    expect(cols).toContain('fixedAmountCents');
    expect(cols).toContain('variableAmountCents');
    expect(cols).toContain('totalAmountCents');
    expect(cols).toContain('planSnapshot');
  });

  it('deliverables expose fixed_share_bps for share-of-fee splits', () => {
    expect(Object.keys(schema.deliverables)).toContain('fixedShareBps');
  });
});
