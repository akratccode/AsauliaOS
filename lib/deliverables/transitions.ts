import type { DeliverableStatus } from './types';

export type TransitionActor = 'admin' | 'operator' | 'client_owner' | 'assignee';

const TRANSITION_MATRIX: Record<
  DeliverableStatus,
  Partial<Record<DeliverableStatus, ReadonlyArray<TransitionActor>>>
> = {
  todo: {
    in_progress: ['admin', 'operator', 'assignee'],
  },
  in_progress: {
    in_review: ['admin', 'operator', 'assignee'],
  },
  in_review: {
    done: ['admin', 'operator', 'client_owner'],
    rejected: ['admin', 'operator', 'client_owner'],
  },
  done: {
    in_review: ['admin', 'operator'],
  },
  rejected: {
    in_progress: ['admin', 'operator', 'assignee'],
  },
};

export function isValidTransition(
  from: DeliverableStatus,
  to: DeliverableStatus,
): boolean {
  return TRANSITION_MATRIX[from]?.[to] !== undefined;
}

export function canActorTransition(
  actor: TransitionActor,
  from: DeliverableStatus,
  to: DeliverableStatus,
): boolean {
  const actors = TRANSITION_MATRIX[from]?.[to];
  return actors?.includes(actor) ?? false;
}

export function allowedNextStatuses(from: DeliverableStatus): DeliverableStatus[] {
  return Object.keys(TRANSITION_MATRIX[from] ?? {}) as DeliverableStatus[];
}
