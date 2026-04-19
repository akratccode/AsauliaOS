'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Brand = { id: string; name: string };

type Props = {
  active: Brand;
  brands: Brand[];
};

export function BrandSwitcher({ active, brands }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (brands.length <= 1) {
    return (
      <span className="text-fg-2 text-sm font-medium">{active.name}</span>
    );
  }

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === active.id) return;
    setBusy(true);
    try {
      await fetch('/api/brand/active', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandId: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <select
      value={active.id}
      onChange={onChange}
      disabled={busy}
      aria-label="Active brand"
      className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1 text-sm"
    >
      {brands.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
