import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  users,
  brands,
  brandMembers,
  plans,
  contractorProfiles,
  brandContractors,
  deliverables,
  deliverableAttachments,
  deliverableComments,
  deliverableActivity,
  salesIntegrations,
  salesRecords,
  invoices,
  payouts,
  notifications,
  auditLog,
  invitations,
} from './schema';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Brand = InferSelectModel<typeof brands>;
export type NewBrand = InferInsertModel<typeof brands>;

export type BrandMember = InferSelectModel<typeof brandMembers>;
export type NewBrandMember = InferInsertModel<typeof brandMembers>;

export type Plan = InferSelectModel<typeof plans>;
export type NewPlan = InferInsertModel<typeof plans>;

export type ContractorProfile = InferSelectModel<typeof contractorProfiles>;
export type NewContractorProfile = InferInsertModel<typeof contractorProfiles>;

export type BrandContractor = InferSelectModel<typeof brandContractors>;
export type NewBrandContractor = InferInsertModel<typeof brandContractors>;

export type Deliverable = InferSelectModel<typeof deliverables>;
export type NewDeliverable = InferInsertModel<typeof deliverables>;

export type DeliverableAttachment = InferSelectModel<typeof deliverableAttachments>;
export type NewDeliverableAttachment = InferInsertModel<typeof deliverableAttachments>;

export type DeliverableComment = InferSelectModel<typeof deliverableComments>;
export type NewDeliverableComment = InferInsertModel<typeof deliverableComments>;

export type DeliverableActivity = InferSelectModel<typeof deliverableActivity>;
export type NewDeliverableActivity = InferInsertModel<typeof deliverableActivity>;

export type SalesIntegration = InferSelectModel<typeof salesIntegrations>;
export type NewSalesIntegration = InferInsertModel<typeof salesIntegrations>;

export type SalesRecord = InferSelectModel<typeof salesRecords>;
export type NewSalesRecord = InferInsertModel<typeof salesRecords>;

export type Invoice = InferSelectModel<typeof invoices>;
export type NewInvoice = InferInsertModel<typeof invoices>;

export type Payout = InferSelectModel<typeof payouts>;
export type NewPayout = InferInsertModel<typeof payouts>;

export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;

export type AuditLog = InferSelectModel<typeof auditLog>;
export type NewAuditLog = InferInsertModel<typeof auditLog>;

export type Invitation = InferSelectModel<typeof invitations>;
export type NewInvitation = InferInsertModel<typeof invitations>;
