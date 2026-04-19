'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LogOut, Settings, User } from 'lucide-react';

type Props = {
  email: string;
  fullName?: string | null;
};

export function UserMenu({ email, fullName }: Props) {
  const [open, setOpen] = useState(false);
  const initials = (fullName || email).slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border-fg-4/20 bg-bg-1 text-fg-1 hover:bg-bg-2 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="bg-asaulia-blue/80 text-fg-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium">
          {initials}
        </span>
        <span className="max-w-[160px] truncate">{fullName ?? email}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="border-fg-4/20 bg-bg-1 absolute right-0 z-10 mt-2 w-48 rounded-md border p-1 shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <Link
            href="/profile"
            className="text-fg-2 hover:bg-bg-2 flex items-center gap-2 rounded px-2 py-1.5 text-sm"
          >
            <User className="size-3.5" /> Profile
          </Link>
          <Link
            href="/settings"
            className="text-fg-2 hover:bg-bg-2 flex items-center gap-2 rounded px-2 py-1.5 text-sm"
          >
            <Settings className="size-3.5" /> Settings
          </Link>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="text-fg-2 hover:bg-bg-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
            >
              <LogOut className="size-3.5" /> Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
