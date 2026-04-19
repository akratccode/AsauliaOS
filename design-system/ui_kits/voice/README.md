# Asaulia Voice UI Kit

The voice surface is Asaulia's **hero experience**. Most of what users do — ask for help on a project, check sales, approve a deliverable, change their plan — they should be able to do with their voice. Artifacts (dashboards, kanbans) are secondary: surfaced as **shortcuts** pushed from voice into dedicated views when visual manipulation is needed.

## Files

- `index.html` — interactive click-thru of the voice surface with states
- `VoiceOrb.jsx` — the breathing mic orb with halo (signature element)
- `VoiceCard.jsx` — the centred glass card the orb lives in
- `VoiceTranscript.jsx` — animated user speech + Asaulia response text
- `ArtifactShortcut.jsx` — pill-shaped deep-links that voice surfaces into the UI (e.g. "Open deliverables", "See this invoice")
- `VoiceStatus.jsx` — state labels (Listening · Thinking · Speaking · Idle)
- `SuggestionChip.jsx` — the pre-voice suggestions row ("How can I help today?")
- `TopBar.jsx` — minimal top bar with brand switcher and close button

## States covered
1. **Idle** — orb resting, gentle halo, 4 suggestion chips
2. **Listening** — orb pulsing, live transcript of user speech appearing in Instrument Serif italic
3. **Thinking** — orb swirling, subtle shimmer on status label
4. **Speaking** — response text fading in, orb animates in sync with "speech"
5. **Artifact suggested** — after a response, one-or-more Artifact Shortcut pills appear offering to open the relevant view

## Design rules
- Single orb; always centred horizontally; lives at ~65% of the viewport height
- Halo is **always** lit from below (never top/sides) — reinforces the "rising voice" metaphor from the reference mocks
- User speech is Instrument Serif italic, Asaulia's reply is Geist
- Keep text short on this surface — it's for listening, not reading. Long content must push the user into an artifact
