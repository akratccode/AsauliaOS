/* globals React, MetricCard, Sparkline, Pill, Btn, KanbanCard */

const SPARK_SALES = [12, 18, 14, 20, 24, 22, 30, 28, 34, 38, 42, 48];

function Dashboard() {
  return (
    <div className="a-view">
      <div className="a-hero-halo" aria-hidden />
      <div className="a-grid-4">
        <MetricCard label="Days left in period" value="12" sub="of 30 · Nov 14 close" />
        <MetricCard label="Deliverables done" value="8 / 12" sub="5 complete · 3 in progress" />
        <MetricCard label="Attributed sales" value="$4,230" sub="Period to date" trend={{dir:'up', pct:'14%'}} spark={SPARK_SALES} />
        <MetricCard label="Projected invoice" value="$899" sub="$299 fixed + $600 variable" elevated />
      </div>

      <div className="a-grid-2" style={{marginTop: 28}}>
        <section className="a-card">
          <header className="a-card-head">
            <h2 className="a-h2" style={{margin:0}}>Daily attributed sales</h2>
            <div className="a-seg">
              <button className="active">This period</button>
              <button>30d</button>
              <button>90d</button>
              <button>All</button>
            </div>
          </header>
          <ChartArea />
          <footer className="a-card-foot a-caption">
            Synced 2 min ago · Shopify, Stripe, WooCommerce
          </footer>
        </section>

        <section className="a-card">
          <header className="a-card-head">
            <h2 className="a-h2" style={{margin:0}}>Recent activity</h2>
            <Btn kind="ghost" onClick={()=>{}}>View all</Btn>
          </header>
          <ul className="a-feed">
            <FeedItem who="Bruno" what="launched" target="Instagram Reel · holiday hook" when="2h" color="#F5B544"/>
            <FeedItem who="Ana" what="submitted for review" target="Homepage rewrite" when="5h" color="#35D39A"/>
            <FeedItem who="Stripe" what="attributed" target="$248 order · Mexico City" when="6h" color="#3A5BFF"/>
            <FeedItem who="You" what="approved" target="Email #34 — Black Friday warmup" when="yesterday" color="#7F95FF"/>
            <FeedItem who="Ana" what="commented on" target="Landing page · header copy" when="yesterday" color="#35D39A"/>
          </ul>
        </section>
      </div>

      <div style={{marginTop: 28}}>
        <section className="a-card">
          <header className="a-card-head">
            <h2 className="a-h2" style={{margin:0}}>Deliverables in flight</h2>
            <Btn kind="ghost" onClick={()=>{}}>Open kanban →</Btn>
          </header>
          <div className="a-dash-kanban">
            <KanbanCard type="ad creative"  title="Instagram Reel · holiday launch hook" owner="Bruno" ownerColor="linear-gradient(135deg,#F5B544,#FF5A6A)" due="Due Nov 2" share="14%" tone="warning"/>
            <KanbanCard type="landing page" title="New homepage · value-first rewrite" owner="Ana" ownerColor="linear-gradient(135deg,#35D39A,#3A5BFF)" due="In review" share="22%" tone="success"/>
            <KanbanCard type="email seq."   title="Black Friday warmup · 3 emails" owner="Laila" ownerColor="linear-gradient(135deg,#7F95FF,#3A5BFF)" due="Due Nov 8" share="9%" tone="neutral"/>
            <KanbanCard type="paid ads"     title="Meta retargeting · Q4 creative refresh" owner="Bruno" ownerColor="linear-gradient(135deg,#F5B544,#FF5A6A)" due="Queued" share="11%" tone="neutral"/>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeedItem({ who, what, target, when, color }) {
  return (
    <li className="a-feed-item">
      <span className="a-feed-av" style={{background: color}}>{who[0]}</span>
      <span className="a-feed-text">
        <strong>{who}</strong> <span className="a-fg-3">{what}</span> <em>{target}</em>
      </span>
      <span className="a-feed-when a-caption">{when}</span>
    </li>
  );
}

function ChartArea() {
  const data = [12, 18, 14, 20, 24, 22, 30, 28, 34, 38, 42, 48];
  const w = 600, h = 180;
  const max = Math.max(...data);
  const pts = data.map((v, i) => [ (i / (data.length - 1)) * w, h - (v / max) * (h - 20) - 10 ]);
  const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg className="a-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="gr" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3A5BFF" stopOpacity="0.35"/>
          <stop offset="1" stopColor="#3A5BFF" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t, i) => (
        <line key={i} x1="0" x2={w} y1={h*t} y2={h*t} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4"/>
      ))}
      <path d={areaPath} fill="url(#gr)"/>
      <path d={linePath} fill="none" stroke="#7F95FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => i === pts.length - 1 && <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#7F95FF" stroke="#fff" strokeWidth="2"/>)}
    </svg>
  );
}

window.Dashboard = Dashboard;
