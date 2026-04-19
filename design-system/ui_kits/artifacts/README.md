# Asaulia Artifacts UI Kit

Artifacts are the **visual, manipulable surfaces** that voice hands the user off to when text alone isn't enough — dashboards, kanban, pricing slider, invoice review. They look like apps but behave like **voice shortcuts** — a close button always returns to the voice surface.

## Files
- `index.html` — click-thru prototype with sidebar nav between Dashboard, Deliverables, Sales, Plan
- `Shell.jsx` — top bar with voice orb return button + sidebar
- `Dashboard.jsx` — hero metric cards, trend chart, recent deliverables
- `Deliverables.jsx` — kanban board (Queue · In progress · In review · Done)
- `Plan.jsx` — pricing slider + plan change confirmation
- `Sales.jsx` — sales chart + attributed sales table
- `parts/` — atomic pieces (MetricCard, KanbanCard, Sparkline, Table, Button, Pill, Sidebar)

## Navigation model
- Persistent sidebar (240px) on desktop
- Top-left "Return to voice" button collapses the artifact back into the voice surface
- Each view has a "Period" indicator and is scoped to the active brand

## Design rules
- Artifacts live on `--bg-0` with subtle halo only at hero sections (dashboard top cards)
- No full-bleed glow — artifacts are for reading, not vibing
- Every number is tabular-nums
- Every big metric has a delta + sparkline — transparency principle (phase 08)
