'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminSearchBar() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex items-center gap-2"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search brands, contractors, IDs…"
        className="border-fg-4/20 bg-bg-2 text-fg-1 w-72 rounded-md border px-3 py-1.5 text-xs"
      />
    </form>
  );
}
