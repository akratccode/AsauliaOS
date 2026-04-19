import { relations } from 'drizzle-orm';
import { users } from './users';
import { brands, brandMembers } from './brands';
import { plans } from './plans';
import { contractorProfiles, brandContractors } from './contractors';
import {
  deliverables,
  deliverableAttachments,
  deliverableComments,
  deliverableActivity,
} from './deliverables';
import { salesIntegrations } from './integrations';
import { salesRecords } from './sales';
import { invoices, payouts } from './billing';
import { notifications } from './notifications';

export const usersRelations = relations(users, ({ one, many }) => ({
  contractorProfile: one(contractorProfiles, {
    fields: [users.id],
    references: [contractorProfiles.userId],
  }),
  memberships: many(brandMembers),
  ownedBrands: many(brands),
  assignedDeliverables: many(deliverables),
  notifications: many(notifications),
  payouts: many(payouts),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  owner: one(users, { fields: [brands.ownerUserId], references: [users.id] }),
  members: many(brandMembers),
  plans: many(plans),
  deliverables: many(deliverables),
  contractors: many(brandContractors),
  salesIntegrations: many(salesIntegrations),
  salesRecords: many(salesRecords),
  invoices: many(invoices),
}));

export const brandMembersRelations = relations(brandMembers, ({ one }) => ({
  brand: one(brands, { fields: [brandMembers.brandId], references: [brands.id] }),
  user: one(users, { fields: [brandMembers.userId], references: [users.id] }),
}));

export const plansRelations = relations(plans, ({ one }) => ({
  brand: one(brands, { fields: [plans.brandId], references: [brands.id] }),
  createdBy: one(users, { fields: [plans.createdByUserId], references: [users.id] }),
}));

export const contractorProfilesRelations = relations(contractorProfiles, ({ one, many }) => ({
  user: one(users, { fields: [contractorProfiles.userId], references: [users.id] }),
  assignments: many(brandContractors),
}));

export const brandContractorsRelations = relations(brandContractors, ({ one }) => ({
  brand: one(brands, { fields: [brandContractors.brandId], references: [brands.id] }),
  contractor: one(users, {
    fields: [brandContractors.contractorUserId],
    references: [users.id],
  }),
}));

export const deliverablesRelations = relations(deliverables, ({ one, many }) => ({
  brand: one(brands, { fields: [deliverables.brandId], references: [brands.id] }),
  assignee: one(users, { fields: [deliverables.assigneeUserId], references: [users.id] }),
  attachments: many(deliverableAttachments),
  comments: many(deliverableComments),
  activity: many(deliverableActivity),
}));

export const deliverableAttachmentsRelations = relations(deliverableAttachments, ({ one }) => ({
  deliverable: one(deliverables, {
    fields: [deliverableAttachments.deliverableId],
    references: [deliverables.id],
  }),
  uploadedBy: one(users, {
    fields: [deliverableAttachments.uploadedByUserId],
    references: [users.id],
  }),
}));

export const deliverableCommentsRelations = relations(deliverableComments, ({ one }) => ({
  deliverable: one(deliverables, {
    fields: [deliverableComments.deliverableId],
    references: [deliverables.id],
  }),
  user: one(users, { fields: [deliverableComments.userId], references: [users.id] }),
}));

export const deliverableActivityRelations = relations(deliverableActivity, ({ one }) => ({
  deliverable: one(deliverables, {
    fields: [deliverableActivity.deliverableId],
    references: [deliverables.id],
  }),
  actor: one(users, { fields: [deliverableActivity.actorUserId], references: [users.id] }),
}));

export const salesIntegrationsRelations = relations(salesIntegrations, ({ one, many }) => ({
  brand: one(brands, { fields: [salesIntegrations.brandId], references: [brands.id] }),
  salesRecords: many(salesRecords),
}));

export const salesRecordsRelations = relations(salesRecords, ({ one }) => ({
  brand: one(brands, { fields: [salesRecords.brandId], references: [brands.id] }),
  integration: one(salesIntegrations, {
    fields: [salesRecords.integrationId],
    references: [salesIntegrations.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  brand: one(brands, { fields: [invoices.brandId], references: [brands.id] }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  contractor: one(users, { fields: [payouts.contractorUserId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
