'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Item = {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  createdAt: string;
  readAt: string | null;
};

type Props = {
  items: Item[];
  unreadCount: number;
};

export function NotificationBell({ items, unreadCount }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="border-fg-4/20 bg-bg-2 text-fg-2 hover:text-fg-1 relative rounded-md border px-2 py-1 text-xs"
      >
        Notifications
        {unreadCount > 0 && (
          <span className="bg-asaulia-blue text-fg-on-blue ml-2 rounded-full px-1.5 text-[10px]">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="border-fg-4/20 bg-bg-1 absolute right-0 z-20 mt-2 w-80 rounded-lg border p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-fg-2 text-xs uppercase tracking-[0.12em]">Recent</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-asaulia-blue-soft text-xs hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-fg-3 p-2 text-xs">Nothing yet.</p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => {
                const content = (
                  <div
                    className={`rounded-md p-2 text-xs ${
                      item.readAt ? 'text-fg-3' : 'text-fg-1 bg-bg-2'
                    }`}
                  >
                    <div className="font-medium">{item.title}</div>
                    {item.body && <div className="text-fg-3 mt-0.5">{item.body}</div>}
                  </div>
                );
                return (
                  <li key={item.id}>
                    {item.linkUrl ? (
                      <Link href={item.linkUrl} onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
