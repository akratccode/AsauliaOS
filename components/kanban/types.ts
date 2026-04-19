import type { DeliverableStatus, DeliverableType } from '@/lib/deliverables/types';

export type KanbanDeliverable = {
  id: string;
  title: string;
  type: DeliverableType;
  status: DeliverableStatus;
  dueDate: string | null;
  fixedShareBps: number;
  assigneeUserId: string | null;
  commentsCount: number;
  attachmentsCount: number;
};
