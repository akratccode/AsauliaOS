/* globals React, MetricCard, SalesRow, Btn, Pill */

function Sales() {
  return (
    <div className="a-view">
      <div className="a-grid-4">
        <MetricCard label="Attributed PTD"    value="$4,230"   sub="Period to date" trend={{dir:'up', pct:'14%'}}/>
        <MetricCard label="Conversion vs last" value="+12.4pp" sub="Period vs last"  trend={{dir:'up', pct:'12pp'}}/>
        <MetricCard label="Attributed orders" value="37"       sub="Avg $114.32"/>
        <MetricCard label="Unattributed"       value="$1,108" sub="26 orders · 20.7%" elevated/>
      </div>

      <section className="a-card" style={{marginTop:28}}>
        <header className="a-card-head">
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <h2 className="a-h2" style={{margin:0}}>All sales</h2>
            <Pill tone="neutral">63 total</Pill>
          </div>
          <div style={{display:'flex', gap:8}}>
            <div className="a-seg">
              <button className="active">All</button>
              <button>Attributed</button>
              <button>Unattributed</button>
            </div>
            <Btn kind="secondary">Export CSV</Btn>
          </div>
        </header>
        <table className="a-table sales">
          <thead><tr><th>Date</th><th>Source</th><th>Amount</th><th>Attribution</th><th>Customer</th></tr></thead>
          <tbody>
            <SalesRow date="2026-11-07 14:22" src="Shopify" amount={248.00} attributed={true}  customer="cust_8f32…a1"/>
            <SalesRow date="2026-11-07 12:08" src="Shopify" amount={84.50}  attributed={true}  customer="cust_c91b…77"/>
            <SalesRow date="2026-11-07 10:41" src="Stripe"  amount={320.00} attributed={false} customer="cust_19af…e4"/>
            <SalesRow date="2026-11-06 19:13" src="Shopify" amount={112.00} attributed={true}  customer="cust_4e0d…b2"/>
            <SalesRow date="2026-11-06 16:02" src="Woo"     amount={68.00}  attributed={true}  customer="cust_2bb4…c0"/>
            <SalesRow date="2026-11-06 09:58" src="Shopify" amount={196.00} attributed={true}  customer="cust_7f12…95"/>
            <SalesRow date="2026-11-05 21:30" src="Stripe"  amount={460.00} attributed={false} customer="cust_3a47…18"/>
            <SalesRow date="2026-11-05 17:14" src="Shopify" amount={84.50}  attributed={true}  customer="cust_ab89…d3"/>
          </tbody>
        </table>
        <footer className="a-card-foot a-caption">
          Attribution rule: click within 7 days prior to purchase on any Asaulia-delivered asset.
        </footer>
      </section>
    </div>
  );
}

window.Sales = Sales;
