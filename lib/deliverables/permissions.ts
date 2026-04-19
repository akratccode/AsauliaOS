import type { AuthContext } from '@/lib/auth/rbac';
import type { TransitionActor } from './transitions';

export type DeliverableContext = {
  brandId: string;
  assigneeUserId: string | null;
  isBrandOwner: boolean;
  isBrandMember: boolean;
  isAssignedContractor: boolean;
};

export function isStaff(actor: AuthContext): boolean {
  return actor.globalRole === 'admin' || actor.globalRole === 'operator';
}

export function isAdmin(actor: AuthContext): boolean {
  return actor.globalRole === 'admin';
}

export function resolveTransitionActor(
  actor: AuthContext,
  ctx: DeliverableContext,
): TransitionActor | null {
  if (actor.globalRole === 'admin') return 'admin';
  if (actor.globalRole === 'operator') return 'operator';
  if (ctx.isBrandOwner) return 'client_owner';
  if (actor.userId === ctx.assigneeUserId) return 'assignee';
  return null;
}

export function canCreate(actor: AuthContext): boolean {
  return isStaff(actor);
}

export function canEditContent(actor: AuthContext): boolean {
  return isStaff(actor);
}

export function canAssign(actor: AuthContext): boolean {
  return isStaff(actor);
}

export function canSetFixedShare(actor: AuthContext): boolean {
  return isAdmin(actor);
}

export function canDelete(actor: AuthContext): boolean {
  return isAdmin(actor);
}

export function canComment(actor: AuthContext, ctx: DeliverableContext): boolean {
  if (isStaff(actor)) return true;
  if (ctx.isBrandMember) return true;
  if (ctx.isAssignedContractor) return true;
  return false;
}

export function canAttach(actor: AuthContext, ctx: DeliverableContext): boolean {
  return canComment(actor, ctx);
}
