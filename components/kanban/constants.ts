import type { DeliverableStatus } from '@/lib/deliverables/types';

export type KanbanColumn = {
  id: DeliverableStatus;
  title: string;
};

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'todo', title: 'Todo' },
  { id: 'in_progress', title: 'In progress' },
  { id: 'in_review', title: 'In review' },
  { id: 'done', title: 'Done' },
  { id: 'rejected', title: 'Rejected' },
];
