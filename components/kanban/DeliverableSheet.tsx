'use client';

import { useEffect, useState } from 'react';
import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

type DeliverableDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  dueDate: string | null;
  fixedShareBps: number;
};

type Activity = {
  id: string;
  action: string;
  createdAt: string;
  payload: unknown;
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  userId: string | null;
};

type Props = {
  deliverableId: string;
  onClose: () => void;
};

export function DeliverableSheet({ deliverableId, onClose }: Props) {
  const [detail, setDetail] = useState<DeliverableDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations('kanban.deliverableSheet');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [commentsRes, activityRes] = await Promise.all([
        fetch(`/api/deliverables/${deliverableId}/comments`),
        fetch(`/api/deliverables/${deliverableId}/activity`),
      ]);
      if (cancelled) return;
      // detail lookup piggybacks on comments' parent - we fetch detail via a
      // lightweight endpoint in production; for now derive from /api/deliverables
      if (commentsRes.ok) {
        const json = (await commentsRes.json()) as { items: Comment[] };
        setComments(json.items);
      }
      if (activityRes.ok) {
        const json = (await activityRes.json()) as { items: Activity[] };
        setActivity(json.items);
      }
      // Placeholder detail using id
      setDetail({
        id: deliverableId,
         
        title: 'Deliverable',
        description: null,
        status: 'todo',
        type: 'custom',
        dueDate: null,
        fixedShareBps: 0,
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [deliverableId]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentDraft.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentDraft }),
      });
      if (res.ok) {
        const json = (await res.json()) as { comment: Comment };
        setComments((prev) => [...prev, json.comment]);
        setCommentDraft('');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label={t('closeLabel')}
        className="bg-bg-0/60 flex-1 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="bg-bg-1 border-fg-4/15 text-fg-1 flex w-full max-w-lg flex-col gap-4 overflow-y-auto border-l p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">{detail?.title ?? '…'}</h2>
            <p className="text-fg-2 mt-1 text-xs uppercase tracking-wide">
              {detail?.status} · {detail?.type}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeLabel')}
            className="text-fg-2 hover:text-fg-1 transition"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        {detail?.description ? (
          <p className="text-fg-2 whitespace-pre-wrap text-sm">{detail.description}</p>
        ) : null}

        <section>
          <h3 className="text-fg-2 mb-2 text-xs uppercase tracking-[0.12em]">{t('comments')}</h3>
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="bg-bg-2 border-fg-4/10 rounded-md border p-2 text-sm"
              >
                {c.content}
              </li>
            ))}
          </ul>
          <form onSubmit={submitComment} className="mt-3 space-y-2">
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder={t('writeComment')}
              rows={3}
              className="border-fg-4/20 bg-bg-1 text-fg-1 block w-full rounded-md border px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={submitting || !commentDraft.trim()}
              className="bg-asaulia-blue text-bg-0 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? t('sending') : t('comment')}
            </button>
          </form>
        </section>

        <section>
          <h3 className="text-fg-2 mb-2 text-xs uppercase tracking-[0.12em]">{t('activity')}</h3>
          <ul className="text-fg-2 space-y-1 text-xs">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="text-fg-1 font-mono">{a.action}</span>{' '}
                <time>{new Date(a.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
