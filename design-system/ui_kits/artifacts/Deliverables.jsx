/* globals React, KanbanCard, Pill, Btn */

function Deliverables() {
  const cols = [
    { id: 'queue',    title: 'Queue',       count: 2, tone: 'neutral' },
    { id: 'inflight', title: 'In progress', count: 3, tone: 'info' },
    { id: 'review',   title: 'In review',   count: 2, tone: 'warning' },
    { id: 'done',     title: 'Done',        count: 5, tone: 'success' },
  ];
  const cards = {
    queue: [
      { type:'paid ads',     title:'Meta retargeting · Q4 creative refresh', owner:'Bruno', ownerColor:'linear-gradient(135deg,#F5B544,#FF5A6A)', due:'Queued', share:'11%', tone:'neutral'},
      { type:'blog',         title:'Pillar: "How a specialty roaster picks beans"', owner:'Ana', ownerColor:'linear-gradient(135deg,#35D39A,#3A5BFF)', due:'Nov 12', share:'8%', tone:'neutral'},
    ],
    inflight: [
      { type:'ad creative',  title:'Instagram Reel · holiday launch hook', owner:'Bruno', ownerColor:'linear-gradient(135deg,#F5B544,#FF5A6A)', due:'Due Nov 2', share:'14%', tone:'warning'},
      { type:'email seq.',   title:'Black Friday warmup · 3 emails', owner:'Laila', ownerColor:'linear-gradient(135deg,#7F95FF,#3A5BFF)', due:'Due Nov 8', share:'9%', tone:'neutral'},
      { type:'photo set',    title:'Winter product photography (24 SKUs)', owner:'Ravi', ownerColor:'linear-gradient(135deg,#35D39A,#7F95FF)', due:'Due Nov 10', share:'12%', tone:'neutral'},
    ],
    review: [
      { type:'landing page', title:'New homepage · value-first rewrite', owner:'Ana', ownerColor:'linear-gradient(135deg,#35D39A,#3A5BFF)', due:'Your review', share:'22%', tone:'success'},
      { type:'ad creative',  title:'TikTok · barista POV series v2', owner:'Bruno', ownerColor:'linear-gradient(135deg,#F5B544,#FF5A6A)', due:'Your review', share:'7%', tone:'success'},
    ],
    done: [
      { type:'email',        title:'Oct newsletter · roaster notes', owner:'Laila', ownerColor:'linear-gradient(135deg,#7F95FF,#3A5BFF)', due:'Shipped Oct 28', share:'4%', tone:'neutral'},
      { type:'ad creative',  title:'Static carousel · "Why 18g"', owner:'Bruno', ownerColor:'linear-gradient(135deg,#F5B544,#FF5A6A)', due:'Shipped Oct 26', share:'6%', tone:'neutral'},
      { type:'landing page', title:'Subscription explainer', owner:'Ana', ownerColor:'linear-gradient(135deg,#35D39A,#3A5BFF)', due:'Shipped Oct 24', share:'9%', tone:'neutral'},
      { type:'blog',         title:'"Our new light roast lineup"', owner:'Ana', ownerColor:'linear-gradient(135deg,#35D39A,#3A5BFF)', due:'Shipped Oct 22', share:'5%', tone:'neutral'},
      { type:'email',        title:'Abandoned cart flow · v2', owner:'Laila', ownerColor:'linear-gradient(135deg,#7F95FF,#3A5BFF)', due:'Shipped Oct 20', share:'6%', tone:'neutral'},
    ],
  };
  return (
    <div className="a-view">
      <div className="a-kanban">
        {cols.map(c => (
          <div key={c.id} className="a-col">
            <header className="a-col-head">
              <span className="a-col-title">{c.title}</span>
              <Pill tone={c.tone}>{c.count}</Pill>
            </header>
            <div className="a-col-stack">
              {cards[c.id].map((k, i) => <KanbanCard key={i} {...k}/>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.Deliverables = Deliverables;
