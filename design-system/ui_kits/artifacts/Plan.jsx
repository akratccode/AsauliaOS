/* globals React, Btn, Pill */
const { useState } = React;

function Plan() {
  const [v, setV] = useState(42); // 0..100
  // interpolate: low = $99 + 20%, high = $1000 + 7%
  const fixed = Math.round(99 + (1000 - 99) * (v / 100));
  const variable = (20 - (20 - 7) * (v / 100)).toFixed(1);

  // projection on $4230 attributed
  const attributed = 4230;
  const projected = fixed + (attributed * parseFloat(variable) / 100);

  return (
    <div className="a-view">
      <div className="a-plan-hero">
        <div className="a-plan-halo" aria-hidden/>
        <div className="a-plan-head">
          <span className="a-label">Your plan · Lumen Coffee</span>
          <div className="a-plan-num">
            <span className="fixed a-number">${fixed}</span>
            <span className="plus">+</span>
            <span className="variable a-number">{variable}%</span>
          </div>
          <p className="a-caption">of attributed sales · billed at cycle close Nov 14</p>
        </div>

        <div className="a-slider-wrap">
          <div className="a-slider-track">
            <div className="a-slider-fill" style={{width: `${v}%`}}/>
            <div className="a-slider-handle" style={{left: `${v}%`}}/>
          </div>
          <input
            type="range" min="0" max="100" value={v}
            onChange={e => setV(+e.target.value)}
            className="a-slider-input"
          />
          <div className="a-slider-anchors">
            <span><strong>Starter</strong><br/>$99 · 20%</span>
            <span><strong>Growth</strong><br/>$499 · 11%</span>
            <span><strong>Pro</strong><br/>$1,000 · 7%</span>
          </div>
        </div>

        <div className="a-plan-proj">
          <div className="a-card inner">
            <span className="a-label">Projection — this period</span>
            <div className="a-proj-row">
              <span>Fixed</span>
              <span className="a-number">${fixed.toFixed(2)}</span>
            </div>
            <div className="a-proj-row">
              <span>Variable <span className="a-fg-3">· {variable}% of $4,230</span></span>
              <span className="a-number">${(attributed * parseFloat(variable)/100).toFixed(2)}</span>
            </div>
            <hr/>
            <div className="a-proj-row total">
              <span>Next invoice</span>
              <span className="a-number">${projected.toFixed(2)}</span>
            </div>
          </div>
          <div className="a-plan-actions">
            <Btn kind="primary">Confirm new plan</Btn>
            <Btn kind="ghost">Cancel</Btn>
            <Pill tone="info">Effective next cycle · Nov 15</Pill>
          </div>
        </div>
      </div>

      <section className="a-card" style={{marginTop: 28}}>
        <header className="a-card-head">
          <h2 className="a-h2" style={{margin:0}}>Plan change history</h2>
        </header>
        <table className="a-table">
          <thead><tr><th>Effective from</th><th>To</th><th>Fixed</th><th>Variable</th><th>Changed by</th></tr></thead>
          <tbody>
            <tr><td>Nov 15, 2026</td><td className="a-fg-3">—</td><td className="a-number">${fixed}</td><td className="a-number">{variable}%</td><td>You (pending)</td></tr>
            <tr><td>Oct 15, 2026</td><td>Nov 14, 2026</td><td className="a-number">$299</td><td className="a-number">14.2%</td><td>You</td></tr>
            <tr><td>Jul 15, 2026</td><td>Oct 14, 2026</td><td className="a-number">$199</td><td className="a-number">16.8%</td><td>Asaulia (onboarding)</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

window.Plan = Plan;
