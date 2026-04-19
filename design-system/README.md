# Asaulia Design System

> The design language and component library for **Asaulia** — a voice-first, done-for-you growth agency subscription. Brands talk to Asaulia. Asaulia orchestrates growth work. Dashboards are secondary "artifacts" that the voice agent can summon when the user needs to drill into a specific surface.

---

## What Asaulia is

Asaulia is an **agency-as-a-service** SaaS with two parallel experiences, united by one brand:

1. **The voice experience (primary).** A conversational interface is the homepage of the product. Brand owners speak to Asaulia about their growth: "What did we sell this week?", "Approve the new ad creative", "Move me closer to the Starter plan". The voice UI is a single glowing surface — card on a dark canvas, waveform, mic — with a deep, calm, tech-optimistic aesthetic.
2. **Artifacts (secondary).** Traditional dashboards, Kanban boards, sales tables, pricing sliders, invoices. These are summoned from the voice surface as **shortcuts** — "Open the deliverables board", "Show me my plan" — and disappear back into the voice flow. They share the same palette and typography but shed most of the glow and breathing motion.

The business model is the differentiator and it shows up visually:
- A **continuous pricing line** from **$99 + 20% variable** (Starter) to **$1,000 + 7% variable** (Pro). The slider is a hero component.
- Revenue is split between Asaulia and a contractor pool; clients see deliverables produced on their behalf.

### Three personas, one shell
- **Brand owner / member** — the client. Voice-first. Dashboard for drill-down.
- **Contractor** — the freelancer. Gets tasks, sees earnings. No voice, artifact-only in v1.
- **Asaulia admin** — internal. Artifact-only, dense and operational.

---

## Sources used to build this system

- **Codebase (PRD):** `akratccode/AsauliaOS` on GitHub — 16 markdown files documenting the full product (PRD + 12 implementation phases). Imported into the project root. The PRD is the only source of truth for product behaviour; component shapes below reference the phase that introduces each screen.
- **Logo:** user-supplied screenshot of the Asaulia wordmark. Recreated as `assets/asaulia-logo.svg`; the raster is preserved at `assets/asaulia-logo-full.png` for reference.
- **Voice UI visual reference:** `assets/reference-voice-card.jpg` (community "Daily Design Challenge" by @mhmoradii — used only as a tone reference for dark-mode glow, waveform, mic, and glass card. Not a direct clone.)
- **"Get started" glass card reference:** `assets/reference-getstarted-card.jpg` — same tone/glass treatment reference.

> The voice experience has **no implementation yet** — it is being designed first to guide Claude Code. Everything in this system for the voice surface is a design proposal rooted in the PRD's business model plus the tonal references above.

---

## Index (manifest of this folder)

```
README.md                — this file
SKILL.md                 — cross-compatible skill wrapper for Claude Code
colors_and_type.css      — CSS custom properties for color + type
preview/                 — cards rendered in the Design System tab
  01-logo.html
  02-palette-core.html
  03-palette-neutrals.html
  04-palette-semantic.html
  05-type-scale.html
  06-type-specimen.html
  07-radii.html
  08-shadows-glass.html
  09-spacing.html
  10-voice-orb.html
  11-buttons.html
  12-inputs.html
  13-cards.html
  14-pricing-slider.html
  15-kanban-card.html
  16-metric-card.html
  17-nav.html
  18-iconography.html
assets/                  — logos, reference imagery
  asaulia-logo.svg
  asaulia-logo-mark.svg
  asaulia-logo-full.png
  reference-voice-card.jpg
  reference-getstarted-card.jpg
ui_kits/
  voice/                 — the voice-first surface (hero experience)
    index.html
    README.md
    VoiceStage.jsx
    VoiceOrb.jsx
    VoiceTranscript.jsx
    VoiceWaveform.jsx
    ArtifactLauncher.jsx
    ShortcutStrip.jsx
  artifacts/             — dashboards, Kanban, pricing, invoices
    index.html
    README.md
    Sidebar.jsx
    TopBar.jsx
    MetricCard.jsx
    KanbanBoard.jsx
    PricingSlider.jsx
    SalesTable.jsx
    InvoiceCard.jsx

# AsauliaOS PRD (imported from GitHub) — source of truth for product behaviour
README.md (in repo root is THIS file; PRD's README renamed to PRD.md? no — kept at root)
PRD.md, ARCHITECTURE.md, 00-INDEX.md, 01-foundation.md ... 12-polish-launch.md
```

---

## CONTENT FUNDAMENTALS

Asaulia is a **growth** brand dressed in calm, competent, slightly ceremonial language. The written voice should feel closer to a senior operator briefing you than a hype-y marketing site.

**Language**
- **English is the UI default.** Spanish localization is a v1.1 drop (the PRD product team is Spanish-speaking internally, but brands and contractors onboard in English first). Copy should be written so it localizes cleanly — avoid idioms, avoid puns.
- **"You", not "we".** The product talks to the user. Asaulia refers to itself in the third person when useful ("Asaulia will send the invoice on Nov 14"), not as "we".
- **Address the user directly in the voice surface.** The voice agent's replies are scripted in first-person from Asaulia's perspective: *"I moved two deliverables to In Review."* In dashboards, system copy is neutral: *"2 deliverables moved to In Review."*

**Casing**
- **Sentence case** everywhere by default — titles, buttons, nav, labels. No Title Case on buttons.
- **UPPERCASE with +0.14em tracking** only for small spec labels (e.g. `CURRENT PERIOD`, `FIXED`, `VARIABLE`). Never for headlines.
- Product name is always **Asaulia** (one capital A). The wordmark is all-lowercase; that's a logo quirk, not a rule for inline mentions.

**Tone cues — examples**

> Warm but quantitative. *"You're 12 days into this cycle — $4,230 attributed so far, on pace for ~$9,800."*

> Transparent about money. Never "smart pricing" or "optimized for you". Say the numbers.
> ✅  *"Your plan: $299 fixed + 14.2% of attributed sales. Break-even vs Starter at $4,700/mo."*
> ❌  *"We've tailored your plan to maximize your growth potential."*

> Present-tense for what the system is doing now. *"Bruno is drafting this week's ad creatives."* Not "will draft".

> Calm about ambiguity. When the system can't answer, it says so. *"I don't have last week's Shopify sync yet. I'll check back in a minute."*

**Emoji & punctuation**
- **No emoji in UI.** The brand is serious about money. Emoji are allowed in chat messages (user-generated) but never in system copy, notifications, dashboards, or marketing.
- **Em-dashes (—) are welcome** — they match the slightly editorial voice.
- **Use `·` as a separator** in metadata rows (`Shopify · attributed · $142.00`).

**Numbers**
- Money always with a currency prefix and `Intl.NumberFormat` — `$299.00`, never `$299` except in hero headlines.
- Percentages to one decimal: `14.2%`, not `14.2 %` and not `0.142`.
- Time ranges with an en-dash: *"Oct 15 – Nov 14"*.
- Tabular numerals (`font-variant-numeric: tabular-nums`) for every column of money.

---

## VISUAL FOUNDATIONS

### Palette

**Brand**
- `--asaulia-blue` **#3A5BFF** — the exact hue of the logo glyph. Primary actions, focus ring, waveform core, pricing slider handle.
- `--asaulia-blue-ink` **#1F35C7** — pressed states, dense graph fills.
- `--asaulia-blue-soft` **#7F95FF** — hover glow, accent text on dark, "fixed" series in charts.
- `--asaulia-blue-glow` **#5B7BFF** — halo centres (used at low opacity behind voice card).
- `--asaulia-ink` **#0B1020** — wordmark, on-light text, serious type.

**Surface (dark-first)** — near-black backdrops with a subtle **cool blue shift**, never pure neutral grey.
- `--bg-0` **#05070F** — outermost backdrop, behind halos.
- `--bg-1` **#080C1A** — primary surface.
- `--bg-2` **#0E1428` — elevated surface, card base.
- `--bg-3` **#151D38** — hovered cards, inset panels.
- `--bg-4` **#1D2648** — pressed / selected nav.

**Foreground**
- `--fg-1` **#F3F5FB** · `--fg-2` **#BDC4DB** · `--fg-3` **#7E87A8** · `--fg-4` **#4A5273**.

**Semantic**
- success **#35D39A** — money *in*, shipped deliverables. Muted; not a pure green.
- warning **#F5B544** — payment issues, plan cooldown, overdue items. Amber leaning warm.
- danger  **#FF5A6A** — rejected deliverables, failed webhooks. Coral, not blood red.

**Pricing-only**
- `--pricing-fixed` **#7F95FF** and `--pricing-variable` **#35D39A`. Every chart that shows fixed-vs-variable uses this exact pair.

### Typography

- **Headlines / UI / numbers:** Geist (400/500/600/700). Chosen for excellent tabular numerals and dense UI density. Geist Mono for code / IDs.
- **Display, editorial, voice quotes:** Instrument Serif (italic). Used sparingly — only for hero voice transcripts, big quote-style moments, and the "we're listening" stage copy. The italic + generous tracking softens the otherwise engineering-heavy shell.
- **Font files:** served from Google Fonts for now. See **Font substitution note** below.

Scale — 12, 13, 15, 17, 20, 24, 32, 44, 60, 84px. 15px base body. 84px reserved for the voice hero states.

### Spacing

4-point grid, 4 → 64. Card interior padding is `--space-6` (24px) by default, `--space-8` (32px) on the voice hero card. Row gap on dense tables is `--space-3` (12px). The pricing slider track has `--space-12` (48px) above/below its label to let the value breathe.

### Backgrounds

- **Voice surface:** full-bleed `--bg-0` with a **large radial glow** (`--glow-voice`) rising from the bottom, behind a single glass card. No images. No gradients on the card itself beyond the subtle top-edge highlight.
- **Artifact (dashboard) surface:** `--bg-1`. No halo by default; the blue glow is reserved for the voice mode. Full-bleed imagery is avoided — Asaulia is a numbers product.
- **Marketing / docs (future):** a warm cream `--asaulia-cream` (#F5F3EE) with `--asaulia-ink` type — an inversion we keep in reserve for the marketing site once it exists.

**Repeating textures:** a single motif — a **fine dot grid** behind the voice card bottom half, at ~2% white, used as the origin line for the waveform. No noise, no paper, no gradients-as-shapes.

### Animation

- **Voice orb breath:** 4.2s ease-in-out loop on the halo scale + opacity (±6%, ±14%). Never pauses while mic is live. Paused otherwise.
- **Waveform:** real-time mirrored sine of audio amplitude; 24px tall in idle, up to 96px when speaking. `cubic-bezier(0.22, 0.61, 0.36, 1)`.
- **Artifact transitions:** 200ms `--ease-standard` for opens, 120ms for hovers. No bounces in the artifact shell — bouncy easing is **reserved** for voice-originated moments (a shortcut being summoned into view).
- **Page transitions:** fade + 8px lift. 420ms `--ease-out`.

### Hover & press states

- **Hover on dark cards:** background steps from `--bg-2` → `--bg-3`. Border brightens `rgba(255,255,255,0.08)` → `0.14`.
- **Hover on buttons:** primary gains a soft `--asaulia-blue-soft` outer glow (`0 0 0 4px rgba(58,91,255,0.22)`). Ghost buttons just brighten text to `--fg-1`.
- **Press:** -1% scale, 120ms. Primary shifts to `--asaulia-blue-ink`.
- **No "lift-on-hover" shadow growth on cards** — we move brightness, not elevation.

### Borders & strokes

Every elevated surface has an **inner 1px top highlight** at 6–12% white — this is the single most recognizable detail of the system. See `--stroke-inner`, `--stroke-inner-strong`. Outer borders are rare; when present, 1px at `--glass-border`.

### Shadows

Dark UI needs **inner highlights** more than outer shadows. The shadow scale is reserved for lifted content:
- `--shadow-sm` for dropdowns and toasts.
- `--shadow-md` for modals.
- `--shadow-lg` for the voice card itself, *plus* the radial glow.

### Transparency & blur

Used **only on the voice card and over the halo** — `backdrop-filter: blur(22px) saturate(1.2)` on a `rgba(21, 29, 56, 0.78)` fill. Do not blur in the artifact shell; dashboards are opaque. Blur is part of the voice vocabulary, not a decoration.

### Corner radii

- Pills: `9999px` — nav chips, status pills, date range selectors.
- Small: 10px — buttons, inputs.
- Medium: 14px — dashboard cards.
- Large: 20–28px — voice card, modals.
- 2xl: 36px — the voice orb card itself (matches the reference).

### Cards

Three card kinds, in descending "specialness":
1. **Voice card** — 36px radius, glass fill, inner strong stroke, radial glow behind. Has blur. Only one per view.
2. **Artifact card** — 14px radius, `--bg-2` fill, inner stroke. No blur. The workhorse.
3. **Inline row card** — 10px radius, `--bg-1` fill, 1px hairline border. Used in tables-as-cards.

### Layout rules

- Fixed top bar on artifacts — 56px tall, `--bg-1` with a 1px bottom hairline.
- Sidebar on artifacts — 240px desktop, collapses to 64px, disappears below 768px (bottom nav takes over).
- Voice surface is **always viewport-filling**. Never scrolls. Transcript expands *within* the card up to 60vh, then scrolls internally.
- Max content width on dashboards: 1280px centred.

### Imagery vibe

When images appear (contractor avatars, brand logos the client uploads) they're rendered in a **16px rounded square** with a thin `--glass-border`. No filters, no grain. The rest of the UI carries the mood; imagery stays neutral.

---

## ICONOGRAPHY

Asaulia has **no custom icon font yet** — the PRD imports `lucide-react` (a line-weight icon set). We adopt **Lucide** as the system's icon library.

- **Source:** `lucide-react` at runtime in the codebase; for prototypes here we reference Lucide via CDN (`https://unpkg.com/lucide-static@0.460.0/icons/*.svg`) or inline SVG copied from lucide.dev.
- **Weight / style:** Lucide's default — 1.5px stroke, 24px grid, rounded caps, rounded joins. **Do not** mix with fill-style or duotone icons. Do not shift stroke weight.
- **Size scale:** 14 / 16 / 20 / 24 / 32 px. 16px is the default inline size.
- **Color:** inherits `currentColor`. Active icons use `--fg-1`; inactive use `--fg-3`. Brand blue (`--asaulia-blue`) is reserved for actions (the mic icon, the primary nav icon when selected).

**Specific icons used across the product** (pin these — don't swap):
- Microphone: `mic` — the hero control.
- Waveform: `audio-waveform` (substitute if unavailable: custom SVG in `assets/waveform.svg`).
- Deliverables Kanban: `kanban`.
- Sales: `trending-up`.
- Plan / pricing: `sliders-horizontal`.
- Billing: `receipt`.
- Team: `users`.
- Settings: `settings`.
- Shortcut launcher: `command`.
- Brand switcher: `chevrons-up-down`.

**Unicode / emoji as icons:** never in product UI. The only Unicode glyph the system uses decoratively is `·` (middle dot, U+00B7) as a metadata separator.

**Illustrations / custom art:** none in v1. The voice glow is the illustration. When a screen needs an empty state, it's text + a button, not a drawing.

### Flagged substitutions
- **Fonts — Geist, Instrument Serif:** pulled from Google Fonts. The PRD does not specify a font; these are proposals chosen to match the brand's "engineering-precise meets editorial-calm" feel. **Please confirm or replace** and we'll wire real `.woff2` files into `fonts/`.
- **Icon library — Lucide:** matches the PRD's declared `lucide-react` dependency. Confirmed in `01-foundation.md`. No substitution needed.
- **Logo glyph:** re-drawn from the raster screenshot as an SVG for crisp rendering. The raster is preserved in `assets/asaulia-logo-full.png` in case you'd prefer to provide the original vector.
