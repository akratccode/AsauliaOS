/* globals React */

/* ---------- Button ---------- */
function Btn({ children, kind = 'primary', icon, onClick, ...rest }) {
  return (
    <button className={`a-btn a-btn-${kind}`} onClick={onClick} {...rest}>
      {icon && <span className="a-btn-icon">{icon}</span>}
      {children}
    </button>
  );
}

/* ---------- Pill ---------- */
function Pill({ children, tone = 'neutral' }) {
  return <span className={`a-pill tone-${tone}`}>{children}</span>;
}

/* ---------- Metric card ---------- */
function MetricCard({ label, value, sub, trend, spark, elevated }) {
  return (
    <div className={`a-metric ${elevated ? 'elevated' : ''}`}>
      <div className="a-metric-label">{label}</div>
      <div className="a-metric-value a-number">{value}</div>
      {spark && <Sparkline data={spark} />}
      <div className="a-metric-foot">
        <span>{sub}</span>
        {trend && <span className={`trend ${trend.dir}`}>{trend.dir === 'up' ? '▲' : '▼'} {trend.pct}</span>}
      </div>
    </div>
  );
}

/* ---------- Sparkline ---------- */
function Sparkline({ data = [], stroke = '#35D39A', height = 32 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const w = 100;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = max === min ? height / 2 : height - ((v - min) / (max - min)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="a-spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts}/>
    </svg>
  );
}

/* ---------- Kanban card ---------- */
function KanbanCard({ type, title, owner, ownerColor, due, share, tone = 'neutral' }) {
  return (
    <div className="a-kanban-card">
      <div className="a-kc-head">
        <span className="a-kc-type">{type}</span>
        <span className="a-kc-share">{share}</span>
      </div>
      <div className="a-kc-title">{title}</div>
      <div className="a-kc-foot">
        <span className="a-kc-owner"><span className="a-kc-avatar" style={{background: ownerColor}}/>{owner}</span>
        <Pill tone={tone}>{due}</Pill>
      </div>
    </div>
  );
}

/* ---------- Table row ---------- */
function SalesRow({ date, src, amount, attributed, customer }) {
  return (
    <tr>
      <td className="a-mono">{date}</td>
      <td>{src}</td>
      <td className="a-number">${amount.toFixed(2)}</td>
      <td>{attributed
        ? <Pill tone="success">Attributed</Pill>
        : <Pill tone="neutral">—</Pill>}</td>
      <td className="a-mono a-fg-3">{customer}</td>
    </tr>
  );
}

Object.assign(window, { Btn, Pill, MetricCard, Sparkline, KanbanCard, SalesRow });
