import 'server-only';
import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import type { AuthContext } from '@/lib/auth/rbac';
import { Forbidden } from '@/lib/auth/errors';
import { db, schema } from '@/lib/db';
import type {
  Deliverable,
  DeliverableActivity as DeliverableActivityRow,
  DeliverableAttachment,
  DeliverableComment,
} from '@/lib/db/types';
import {
  canAssign,
  canAttach,
  canComment,
  canCreate,
  canDelete,
  canEditContent,
  canSetFixedShare,
  isAdmin,
  isStaff,
  resolveTransitionActor,
  type DeliverableContext,
} from './permissions';
import {
  canActorTransition,
  isValidTransition,
  type TransitionActor,
} from './transitions';
import type { DeliverableStatus, DeliverableType } from './types';
import { validateSingleShareBps } from './allocation';
import {
  buildAttachmentPath,
  validateAttachmentInput,
} from './attachments';
import { extractMentions } from './mentions';

function first<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (!row) throw new Error(`${what} returned no rows`);
  return row;
}

export class InvalidTransitionError extends Error {
  code = 'invalid_transition' as const;
  constructor(from: DeliverableStatus, to: DeliverableStatus) {
    super(`Invalid transition ${from} → ${to}`);
  }
}

type CreateInput = {
  brandId: string;
  title: string;
  description?: string | null;
  type: DeliverableType;
  periodStart: string;
  periodEnd: string;
  assigneeUserId?: string | null;
  dueDate?: string | null;
  fixedShareBps?: number;
};

async function loadContext(
  actor: AuthContext,
  deliverable: Pick<Deliverable, 'brandId' | 'assigneeUserId'>,
): Promise<DeliverableContext> {
  let isBrandMember = false;
  let isBrandOwner = false;
  if (!isStaff(actor)) {
    const memberRow = await db
      .select({ role: schema.brandMembers.role })
      .from(schema.brandMembers)
      .where(
        and(
          eq(schema.brandMembers.brandId, deliverable.brandId),
          eq(schema.brandMembers.userId, actor.userId),
        ),
      )
      .limit(1);
    if (memberRow[0]) {
      isBrandMember = true;
      isBrandOwner = memberRow[0].role === 'owner';
    }
  }

  let isAssignedContractor = false;
  if (actor.globalRole === 'contractor') {
    const assignRow = await db
      .select({ id: schema.brandContractors.id })
      .from(schema.brandContractors)
      .where(
        and(
          eq(schema.brandContractors.brandId, deliverable.brandId),
          eq(schema.brandContractors.contractorUserId, actor.userId),
        ),
      )
      .limit(1);
    isAssignedContractor = assignRow.length > 0;
  }

  return {
    brandId: deliverable.brandId,
    assigneeUserId: deliverable.assigneeUserId,
    isBrandOwner,
    isBrandMember,
    isAssignedContractor,
  };
}

async function logActivity(params: {
  deliverableId: string;
  actorUserId: string;
  action: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(schema.deliverableActivity).values({
    deliverableId: params.deliverableId,
    actorUserId: params.actorUserId,
    action: params.action,
    payload: params.payload ?? null,
  });
}

export async function createDeliverable(
  actor: AuthContext,
  input: CreateInput,
): Promise<Deliverable> {
  if (!canCreate(actor)) throw new Forbidden('Cannot create deliverables');
  if (input.fixedShareBps !== undefined) {
    if (!canSetFixedShare(actor)) {
      throw new Forbidden('Only admin can set fixed_share_bps');
    }
    validateSingleShareBps(input.fixedShareBps);
  }

  const inserted = await db
    .insert(schema.deliverables)
    .values({
      brandId: input.brandId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      assigneeUserId: input.assigneeUserId ?? null,
      dueDate: input.dueDate ?? null,
      fixedShareBps: input.fixedShareBps ?? 0,
      createdByUserId: actor.userId,
    })
    .returning();
  const row = first(inserted, 'createDeliverable');

  await logActivity({
    deliverableId: row.id,
    actorUserId: actor.userId,
    action: 'created',
    payload: { title: row.title, type: row.type },
  });
  return row;
}

export async function updateDeliverableContent(
  actor: AuthContext,
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    type?: DeliverableType;
    dueDate?: string | null;
    fixedShareBps?: number;
  },
): Promise<Deliverable> {
  const existing = await getDeliverableById(id);
  if (!canEditContent(actor)) throw new Forbidden('Cannot edit deliverable content');
  if (patch.fixedShareBps !== undefined) {
    if (!canSetFixedShare(actor)) {
      throw new Forbidden('Only admin can set fixed_share_bps');
    }
    validateSingleShareBps(patch.fixedShareBps);
  }

  const updated = await db
    .update(schema.deliverables)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.deliverables.id, id))
    .returning();
  const row = first(updated, 'updateDeliverableContent');

  await logActivity({
    deliverableId: row.id,
    actorUserId: actor.userId,
    action: 'updated',
    payload: { before: existing, after: row },
  });
  return row;
}

export async function updateDeliverableStatus(
  actor: AuthContext,
  id: string,
  nextStatus: DeliverableStatus,
): Promise<Deliverable> {
  const existing = await getDeliverableById(id);
  const from = existing.status as DeliverableStatus;
  if (!isValidTransition(from, nextStatus)) {
    throw new InvalidTransitionError(from, nextStatus);
  }
  const context = await loadContext(actor, existing);
  const transitionActor: TransitionActor | null = resolveTransitionActor(actor, context);
  if (!transitionActor || !canActorTransition(transitionActor, from, nextStatus)) {
    throw new Forbidden(`Cannot move deliverable from ${from} to ${nextStatus}`);
  }

  const completedAt = nextStatus === 'done' ? new Date() : existing.completedAt;
  const updated = await db
    .update(schema.deliverables)
    .set({ status: nextStatus, completedAt, updatedAt: new Date() })
    .where(eq(schema.deliverables.id, id))
    .returning();
  const row = first(updated, 'updateDeliverableStatus');

  await logActivity({
    deliverableId: row.id,
    actorUserId: actor.userId,
    action: 'status_changed',
    payload: { from, to: nextStatus },
  });
  return row;
}

export async function assignDeliverable(
  actor: AuthContext,
  id: string,
  assigneeUserId: string | null,
): Promise<Deliverable> {
  if (!canAssign(actor)) throw new Forbidden('Cannot assign deliverables');
  const existing = await getDeliverableById(id);
  const updated = await db
    .update(schema.deliverables)
    .set({ assigneeUserId, updatedAt: new Date() })
    .where(eq(schema.deliverables.id, id))
    .returning();
  const row = first(updated, 'assignDeliverable');
  await logActivity({
    deliverableId: row.id,
    actorUserId: actor.userId,
    action: 'assigned',
    payload: { from: existing.assigneeUserId, to: assigneeUserId },
  });
  return row;
}

export async function archiveDeliverable(
  actor: AuthContext,
  id: string,
): Promise<Deliverable> {
  if (!canDelete(actor)) throw new Forbidden('Cannot archive deliverables');
  const updated = await db
    .update(schema.deliverables)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.deliverables.id, id))
    .returning();
  const row = first(updated, 'archiveDeliverable');
  await logActivity({
    deliverableId: row.id,
    actorUserId: actor.userId,
    action: 'archived',
  });
  return row;
}

export async function addComment(
  actor: AuthContext,
  deliverableId: string,
  content: string,
): Promise<DeliverableComment> {
  const existing = await getDeliverableById(deliverableId);
  const context = await loadContext(actor, existing);
  if (!canComment(actor, context)) {
    throw new Forbidden('Cannot comment on this deliverable');
  }

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.deliverableComments)
      .values({
        deliverableId,
        userId: actor.userId,
        content,
      })
      .returning();
    const comment = first(inserted, 'addComment');

    const mentionTokens = extractMentions(content);
    if (mentionTokens.length > 0) {
      const mentionedUserIds = await resolveMentionUserIds(
        tx,
        existing.brandId,
        mentionTokens,
      );
      if (mentionedUserIds.length > 0) {
        await tx.insert(schema.deliverableCommentMentions).values(
          mentionedUserIds.map((userId) => ({
            commentId: comment.id,
            mentionedUserId: userId,
          })),
        );
      }
    }

    await tx.insert(schema.deliverableActivity).values({
      deliverableId,
      actorUserId: actor.userId,
      action: 'commented',
      payload: { commentId: comment.id },
    });
    return comment;
  });
}

type MentionTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function resolveMentionUserIds(
  tx: MentionTx,
  brandId: string,
  tokens: string[],
): Promise<string[]> {
  // Usernames are matched against the local-part of users.email (everything
  // before '@'), restricted to brand members and assigned contractors.
  const candidates = await tx
    .select({
      id: schema.users.id,
      email: schema.users.email,
    })
    .from(schema.users)
    .leftJoin(
      schema.brandMembers,
      and(
        eq(schema.brandMembers.userId, schema.users.id),
        eq(schema.brandMembers.brandId, brandId),
      ),
    )
    .leftJoin(
      schema.brandContractors,
      and(
        eq(schema.brandContractors.contractorUserId, schema.users.id),
        eq(schema.brandContractors.brandId, brandId),
      ),
    )
    .where(
      or(
        eq(schema.brandMembers.brandId, brandId),
        eq(schema.brandContractors.brandId, brandId),
      ),
    );

  const byToken = new Map<string, string>();
  for (const row of candidates) {
    const local = row.email.split('@')[0]?.toLowerCase();
    if (local) byToken.set(local, row.id);
  }
  const ids = new Set<string>();
  for (const t of tokens) {
    const id = byToken.get(t.toLowerCase());
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

export async function addAttachment(
  actor: AuthContext,
  deliverableId: string,
  input: {
    fileName: string;
    mimeType: string | null;
    sizeBytes: number;
    uuid: string;
  },
): Promise<DeliverableAttachment> {
  const existing = await getDeliverableById(deliverableId);
  const context = await loadContext(actor, existing);
  if (!canAttach(actor, context)) {
    throw new Forbidden('Cannot attach files to this deliverable');
  }
  validateAttachmentInput({ mimeType: input.mimeType, sizeBytes: input.sizeBytes });

  const filePath = buildAttachmentPath({
    brandId: existing.brandId,
    deliverableId,
    fileName: input.fileName,
    uuid: input.uuid,
  });

  const inserted = await db
    .insert(schema.deliverableAttachments)
    .values({
      deliverableId,
      filePath,
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes,
      uploadedByUserId: actor.userId,
    })
    .returning();
  const row = first(inserted, 'addAttachment');

  await logActivity({
    deliverableId,
    actorUserId: actor.userId,
    action: 'attached',
    payload: { fileName: input.fileName, filePath },
  });
  return row;
}

export async function getDeliverableById(id: string): Promise<Deliverable> {
  const row = await db
    .select()
    .from(schema.deliverables)
    .where(eq(schema.deliverables.id, id))
    .limit(1);
  if (!row[0]) throw new Error(`Deliverable ${id} not found`);
  return row[0];
}

export async function listDeliverablesForBrand(
  actor: AuthContext,
  brandId: string,
  period?: { start: string; end: string },
): Promise<Deliverable[]> {
  if (!isStaff(actor)) {
    const member = await db
      .select({ id: schema.brandMembers.id })
      .from(schema.brandMembers)
      .where(
        and(
          eq(schema.brandMembers.brandId, brandId),
          eq(schema.brandMembers.userId, actor.userId),
        ),
      )
      .limit(1);
    if (!member[0]) throw new Forbidden('Not a member of this brand');
  }

  const where = [
    eq(schema.deliverables.brandId, brandId),
    isNull(schema.deliverables.archivedAt),
  ];
  if (period) {
    where.push(gte(schema.deliverables.periodStart, period.start));
    where.push(lte(schema.deliverables.periodEnd, period.end));
  }
  return db
    .select()
    .from(schema.deliverables)
    .where(and(...where))
    .orderBy(schema.deliverables.createdAt);
}

export async function listDeliverablesForContractor(
  actor: AuthContext,
): Promise<Deliverable[]> {
  if (actor.globalRole !== 'contractor' && !isStaff(actor)) {
    throw new Forbidden('Only contractors see their tasks');
  }
  return db
    .select()
    .from(schema.deliverables)
    .where(
      and(
        eq(schema.deliverables.assigneeUserId, actor.userId),
        isNull(schema.deliverables.archivedAt),
      ),
    )
    .orderBy(schema.deliverables.dueDate);
}

export async function listActivity(
  actor: AuthContext,
  deliverableId: string,
): Promise<DeliverableActivityRow[]> {
  const existing = await getDeliverableById(deliverableId);
  const context = await loadContext(actor, existing);
  if (!isStaff(actor) && !context.isBrandMember && !context.isAssignedContractor) {
    throw new Forbidden('Cannot read activity');
  }
  return db
    .select()
    .from(schema.deliverableActivity)
    .where(eq(schema.deliverableActivity.deliverableId, deliverableId))
    .orderBy(desc(schema.deliverableActivity.createdAt));
}

export async function listComments(
  actor: AuthContext,
  deliverableId: string,
): Promise<DeliverableComment[]> {
  const existing = await getDeliverableById(deliverableId);
  const context = await loadContext(actor, existing);
  if (!isStaff(actor) && !context.isBrandMember && !context.isAssignedContractor) {
    throw new Forbidden('Cannot read comments');
  }
  return db
    .select()
    .from(schema.deliverableComments)
    .where(eq(schema.deliverableComments.deliverableId, deliverableId))
    .orderBy(schema.deliverableComments.createdAt);
}

export async function listAttachments(
  actor: AuthContext,
  deliverableId: string,
): Promise<DeliverableAttachment[]> {
  const existing = await getDeliverableById(deliverableId);
  const context = await loadContext(actor, existing);
  if (!isStaff(actor) && !context.isBrandMember && !context.isAssignedContractor) {
    throw new Forbidden('Cannot read attachments');
  }
  return db
    .select()
    .from(schema.deliverableAttachments)
    .where(eq(schema.deliverableAttachments.deliverableId, deliverableId))
    .orderBy(desc(schema.deliverableAttachments.uploadedAt));
}

// Re-export helpers used by the API layer
export { isAdmin, isStaff };
export { inArray };
