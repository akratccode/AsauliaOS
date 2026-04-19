'use client';

import { useDraggable } from '@dnd-kit/core';
import { CalendarIcon, MessageCircleIcon, PaperclipIcon } from 'lucide-react';
import type { KanbanDeliverable } from './types';

type Props = {
  deliverable: KanbanDeliverable;
  onOpen: (id: string) => void;
};

function formatSharePct(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export function KanbanCard({ deliverable, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deliverable.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onOpen(deliverable.id);
        }
      }}
      onClick={(e) => {
        if (e.detail === 0) return;
        onOpen(deliverable.id);
      }}
      className={`bg-bg-2 border-fg-4/15 text-fg-1 group w-full cursor-grab rounded-md border p-3 text-left transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug">{deliverable.title}</h3>
        <span className="text-fg-2 bg-bg-1 border-fg-4/20 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          {deliverable.type.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="text-fg-2 mt-2 flex items-center gap-3 text-xs">
        <span className="font-mono">{formatSharePct(deliverable.fixedShareBps)}</span>
        {deliverable.dueDate ? (
          <span className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            {deliverable.dueDate}
          </span>
        ) : null}
        {deliverable.commentsCount > 0 ? (
          <span className="flex items-center gap-1">
            <MessageCircleIcon className="h-3 w-3" />
            {deliverable.commentsCount}
          </span>
        ) : null}
        {deliverable.attachmentsCount > 0 ? (
          <span className="flex items-center gap-1">
            <PaperclipIcon className="h-3 w-3" />
            {deliverable.attachmentsCount}
          </span>
        ) : null}
      </div>
    </article>
  );
}
