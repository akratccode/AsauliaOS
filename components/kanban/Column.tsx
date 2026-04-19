'use client';

import { useDroppable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import type { KanbanColumn } from './constants';
import type { KanbanDeliverable } from './types';
import type { DeliverableStatus } from '@/lib/deliverables/types';
import { KanbanCard } from './Card';

type Props = {
  column: KanbanColumn;
  cards: KanbanDeliverable[];
  onOpenCard: (id: string) => void;
};

const STATUS_LABEL_KEYS: Record<DeliverableStatus, 'todo' | 'inProgress' | 'inReview' | 'done' | 'rejected'> = {
  todo: 'todo',
  in_progress: 'inProgress',
  in_review: 'inReview',
  done: 'done',
  rejected: 'rejected',
};

function sumShareBps(cards: KanbanDeliverable[]): number {
  return cards.reduce((acc, c) => acc + c.fixedShareBps, 0);
}

export function KanbanColumnView({ column, cards, onOpenCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const tStatus = useTranslations('statuses.deliverable');
  const tBoard = useTranslations('kanban.board');
  const tColumn = useTranslations('kanban.column');
  const sharePct = (sumShareBps(cards) / 100).toFixed(1);
  const title = tStatus(STATUS_LABEL_KEYS[column.id]);

  return (
    <section
      ref={setNodeRef}
      className={`bg-bg-2/60 border-fg-4/10 flex min-w-64 flex-1 flex-col gap-2 rounded-lg border p-3 transition-colors ${
        isOver ? 'border-asaulia-blue/60' : ''
      }`}
      aria-label={`${title} ${tBoard('column')}`}
    >
      <header className="flex items-baseline justify-between">
        <h2 className="text-fg-1 text-sm font-medium">{title}</h2>
        <span className="text-fg-2 text-xs">
          {cards.length} · {sharePct}%
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <KanbanCard key={card.id} deliverable={card} onOpen={onOpenCard} />
        ))}
        {cards.length === 0 ? (
          <div className="border-fg-4/10 text-fg-3 rounded-md border border-dashed p-3 text-center text-xs">
            {tColumn('noDeliverables')}
          </div>
        ) : null}
      </div>
    </section>
  );
}
