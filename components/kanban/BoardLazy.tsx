'use client';

import dynamic from 'next/dynamic';
import type { KanbanDeliverable } from './types';

const Board = dynamic(() => import('./Board').then((m) => m.Board), {
  ssr: false,
  loading: () => (
    <div className="border-fg-4/15 bg-bg-1 h-96 animate-pulse rounded-2xl border" />
  ),
});

export function BoardLazy({ initialDeliverables }: { initialDeliverables: KanbanDeliverable[] }) {
  return <Board initialDeliverables={initialDeliverables} />;
}
