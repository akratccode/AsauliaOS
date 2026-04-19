import { randomUUID } from 'node:crypto';
import { db, schema } from '@/lib/db';

const {
  users,
  brands,
  brandMembers,
  plans,
  contractorProfiles,
  brandContractors,
  deliverables,
  salesIntegrations,
  salesRecords,
} = schema;

async function reset() {
  await db.delete(salesRecords);
  await db.delete(salesIntegrations);
  await db.delete(deliverables);
  await db.delete(brandContractors);
  await db.delete(plans);
  await db.delete(brandMembers);
  await db.delete(brands);
  await db.delete(contractorProfiles);
  await db.delete(users);
}

const ids = {
  admin: randomUUID(),
  ana: randomUUID(),
  bruno: randomUUID(),
  founder1: randomUUID(),
  founder2: randomUUID(),
  brandOne: randomUUID(),
  brandTwo: randomUUID(),
};

async function seedUsers() {
  await db.insert(users).values([
    { id: ids.admin, email: 'admin@asaulia.test', fullName: 'Asaulia Admin', globalRole: 'admin' },
    { id: ids.ana, email: 'ana@asaulia.test', fullName: 'Ana Rivera', globalRole: 'contractor' },
    { id: ids.bruno, email: 'bruno@asaulia.test', fullName: 'Bruno Keller', globalRole: 'contractor' },
    { id: ids.founder1, email: 'founder1@brandone.test', fullName: 'Brand One Founder', globalRole: 'client' },
    { id: ids.founder2, email: 'founder2@brandtwo.test', fullName: 'Brand Two Founder', globalRole: 'client' },
  ]);

  await db.insert(contractorProfiles).values([
    { userId: ids.ana, headline: 'Ads + landing pages', skills: ['ads', 'landing'], status: 'active' },
    { userId: ids.bruno, headline: 'SEO + content', skills: ['seo', 'content'], status: 'active' },
  ]);
}

async function seedBrands() {
  await db.insert(brands).values([
    { id: ids.brandOne, slug: 'brand-one', name: 'Brand One', ownerUserId: ids.founder1, status: 'active', billingCycleDay: 1 },
    { id: ids.brandTwo, slug: 'brand-two', name: 'Brand Two', ownerUserId: ids.founder2, status: 'trial', billingCycleDay: 15 },
  ]);

  await db.insert(brandMembers).values([
    { brandId: ids.brandOne, userId: ids.founder1, role: 'owner', acceptedAt: new Date() },
    { brandId: ids.brandTwo, userId: ids.founder2, role: 'owner', acceptedAt: new Date() },
  ]);

  await db.insert(plans).values([
    { brandId: ids.brandOne, fixedAmountCents: 9900, variablePercentBps: 2000, effectiveFrom: new Date(), createdByUserId: ids.admin },
    { brandId: ids.brandTwo, fixedAmountCents: 50000, variablePercentBps: 1421, effectiveFrom: new Date(), createdByUserId: ids.admin },
  ]);

  await db.insert(brandContractors).values([
    { brandId: ids.brandOne, contractorUserId: ids.ana, role: 'Ads', startedAt: new Date() },
    { brandId: ids.brandOne, contractorUserId: ids.bruno, role: 'SEO', startedAt: new Date() },
    { brandId: ids.brandTwo, contractorUserId: ids.ana, role: 'Landing', startedAt: new Date() },
  ]);
}

async function seedDeliverables() {
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  periodEnd.setUTCDate(0);

  const statuses = ['todo', 'in_progress', 'in_review', 'done', 'rejected'] as const;
  const rows: (typeof deliverables.$inferInsert)[] = [];

  for (const brandId of [ids.brandOne, ids.brandTwo]) {
    for (let i = 0; i < 5; i++) {
      rows.push({
        brandId,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        title: `Deliverable ${i + 1}`,
        type: i % 2 === 0 ? 'content_post' : 'ad_creative',
        status: statuses[i]!,
        assigneeUserId: i % 2 === 0 ? ids.ana : ids.bruno,
        fixedShareBps: 2000,
        createdByUserId: ids.admin,
      });
    }
  }

  await db.insert(deliverables).values(rows);
}

async function seedSales() {
  const [integOne, integTwo] = [randomUUID(), randomUUID()];
  await db.insert(salesIntegrations).values([
    { id: integOne, brandId: ids.brandOne, provider: 'manual', status: 'active', displayName: 'Manual entry' },
    { id: integTwo, brandId: ids.brandTwo, provider: 'shopify', status: 'active', displayName: 'brand-two.myshopify.com' },
  ]);

  const rows: (typeof salesRecords.$inferInsert)[] = [];
  for (const [brandId, integrationId] of [[ids.brandOne, integOne], [ids.brandTwo, integTwo]] as const) {
    for (let i = 0; i < 20; i++) {
      rows.push({
        brandId,
        integrationId,
        externalId: `seed-${brandId.slice(0, 6)}-${i}`,
        amountCents: 1000 + i * 500,
        occurredAt: new Date(Date.now() - i * 86_400_000),
        attributed: i % 3 === 0,
        attributionReason: i % 3 === 0 ? 'utm_source=asaulia' : null,
      });
    }
  }

  await db.insert(salesRecords).values(rows);
}

async function main() {
  console.log('Wiping tenant tables…');
  await reset();
  console.log('Seeding users…');
  await seedUsers();
  console.log('Seeding brands + plans + memberships…');
  await seedBrands();
  console.log('Seeding deliverables…');
  await seedDeliverables();
  console.log('Seeding sales…');
  await seedSales();
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
