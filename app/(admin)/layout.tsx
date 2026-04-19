import type { ReactNode } from 'react';
import { requireAuth } from '@/lib/auth/rbac';
import { Forbidden } from '@/lib/auth/errors';
import { AdminSidebar } from '@/components/admin-shell/Sidebar';
import { AdminSearchBar } from '@/components/admin-shell/SearchBar';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireAuth();
  if (actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    throw new Forbidden('Admin access only');
  }

  return (
    <div className="bg-bg-0 text-fg-1 flex min-h-dvh">
      <AdminSidebar />
      <div className="flex w-full flex-col">
        <header className="border-fg-4/10 flex items-center justify-between gap-4 border-b px-6 py-3">
          <AdminSearchBar />
          <div className="flex items-center gap-3">
            <span className="bg-warning/15 text-warning rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.12em]">
              {actor.globalRole}
            </span>
            <span className="text-fg-3 hidden text-xs md:inline">{actor.email}</span>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
