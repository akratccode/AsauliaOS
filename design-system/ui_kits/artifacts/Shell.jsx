/* globals React */
const { useState } = React;

function Sidebar({ active, onNav }) {
  const items = [
    { id: 'dashboard',    label: 'Dashboard',    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg> },
    { id: 'deliverables', label: 'Deliverables', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="7" rx="1"/></svg> },
    { id: 'sales',        label: 'Sales',        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
    { id: 'plan',         label: 'Plan',         icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/></svg> },
    { id: 'billing',      label: 'Billing',      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2Z"/></svg> },
  ];

  return (
    <aside className="a-sidebar">
      <div className="a-brand-row">
        <div className="a-brand-mark">
          <svg width="20" height="20" viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="#3A5BFF"/><circle cx="20" cy="20" r="6" fill="#fff"/></svg>
        </div>
        <div className="a-brand-text">
          <div className="a-brand-name">Asaulia</div>
          <div className="a-brand-sub">Lumen Coffee</div>
        </div>
      </div>

      <nav className="a-nav">
        {items.map(it => (
          <button key={it.id} className={`a-nav-item ${active === it.id ? 'active' : ''}`} onClick={() => onNav(it.id)}>
            <span className="a-nav-icon">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </nav>

      <div className="a-side-foot">
        <button className="a-return-voice">
          <span className="a-return-orb"/>
          <span>Return to voice</span>
        </button>
        <div className="a-period">Period · Nov 1 – Nov 14</div>
      </div>
    </aside>
  );
}

function TopBar({ title, subtitle, actions }) {
  return (
    <div className="a-topbar">
      <div>
        <h1 className="a-h1" style={{margin:0}}>{title}</h1>
        {subtitle && <p className="a-caption" style={{margin:'4px 0 0'}}>{subtitle}</p>}
      </div>
      <div className="a-topbar-actions">{actions}</div>
    </div>
  );
}

Object.assign(window, { Sidebar, TopBar });
