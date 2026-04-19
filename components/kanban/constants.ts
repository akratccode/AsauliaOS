import type { DeliverableStatus } from '@/lib/deliverables/types';

export type KanbanColumn = {
  id: DeliverableStatus;
};

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'todo' },
  { id: 'in_progress' },
  { id: 'in_review' },
  { id: 'done' },
  { id: 'rejected' },
];
