/* globals React, Sidebar, TopBar, Dashboard, Deliverables, Sales, Plan, Btn */
const { useState } = React;

function App() {
  const [active, setActive] = useState('dashboard');

  const views = {
    dashboard:    { title:'Overview',     subtitle:'Your brand right now · Period Nov 1 – Nov 14', C: Dashboard },
    deliverables: { title:'Deliverables', subtitle:'12 in flight this period',                     C: Deliverables },
    sales:        { title:'Sales',        subtitle:'$4,230 attributed · 37 orders',                C: Sales },
    plan:         { title:'Plan',         subtitle:'$299 + 14.2% · next close Nov 14',             C: Plan },
    billing:      { title:'Billing',      subtitle:'Coming soon',                                  C: () => <EmptyState label="Billing view lives in the full app"/> },
  };
  const V = views[active].C;

  return (
    <div className="a-app" data-screen-label={views[active].title}>
      <Sidebar active={active} onNav={setActive}/>
      <main className="a-main">
        <TopBar
          title={views[active].title}
          subtitle={views[active].subtitle}
          actions={
            <>
              <button className="a-seg" style={{display:'inline-flex'}}>
                <span style={{padding:'6px 12px', color:'var(--fg-1)'}}>Lumen Coffee</span>
              </button>
              <Btn kind="secondary" icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}>Sync now</Btn>
              <div className="a-user-avatar" title="You">L</div>
            </>
          }
        />
        <V/>
      </main>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ padding: 80, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
      {label}
    </div>
  );
}

window.App = App;
