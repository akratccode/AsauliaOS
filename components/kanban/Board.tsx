'use client';

import { useMemo, useState } from 'react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { KanbanColumnView } from './Column';
import { KANBAN_COLUMNS } from './constants';
import type { KanbanDeliverable } from './types';
import type { DeliverableStatus } from '@/lib/deliverables/types';
import { isValidTransition } from '@/lib/deliverables/transitions';
import { DeliverableSheet } from './DeliverableSheet';

type Props = {
  initialDeliverables: KanbanDeliverable[];
};

const STATUS_LABEL_KEYS: Record<DeliverableStatus, 'todo' | 'inProgress' | 'inReview' | 'done' | 'rejected'> = {
  todo: 'todo',
  in_progress: 'inProgress',
  in_review: 'inReview',
  done: 'done',
  rejected: 'rejected',
};

export function Board({ initialDeliverables }: Props) {
  const [cards, setCards] = useState<KanbanDeliverable[]>(initialDeliverables);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const t = useTranslations('kanban.board');
  const tStatus = useTranslations('statuses.deliverable');

  const grouped = useMemo(() => {
    const map: Record<DeliverableStatus, KanbanDeliverable[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
      rejected: [],
    };
    for (const c of cards) map[c.status].push(c);
    return map;
  }, [cards]);

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const deliverableId = String(active.id);
    const targetStatus = String(over.id) as DeliverableStatus;
    const card = cards.find((c) => c.id === deliverableId);
    if (!card || card.status === targetStatus) return;

    if (!isValidTransition(card.status, targetStatus)) {
      setToast(
        t('invalidTransition', {
          from: tStatus(STATUS_LABEL_KEYS[card.status]),
          to: tStatus(STATUS_LABEL_KEYS[targetStatus]),
        }),
      );
      setTimeout(() => setToast(null), 2500);
      return;
    }

    const previous = card.status;
    setCards((prev) =>
      prev.map((c) => (c.id === deliverableId ? { ...c, status: targetStatus } : c)),
    );
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error('server_rejected');
    } catch {
      setCards((prev) =>
        prev.map((c) => (c.id === deliverableId ? { ...c, status: previous } : c)),
      );
      setToast(t('changeRejected'));
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <div className="relative">
      <DndContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumnView
              key={col.id}
              column={col}
              cards={grouped[col.id]}
              onOpenCard={setOpenId}
            />
          ))}
        </div>
      </DndContext>
      {openId ? (
        <DeliverableSheet deliverableId={openId} onClose={() => setOpenId(null)} />
      ) : null}
      {toast ? (
        <div
          role="status"
          className="bg-bg-2 border-fg-4/20 text-fg-1 fixed bottom-6 right-6 rounded-md border px-3 py-2 text-sm shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
