/* globals React, VoiceOrb, VoiceStatus, SuggestionChip, ArtifactShortcut, VoiceTranscript, TopBar */
const { useState, useEffect, useRef } = React;

const SUGGESTIONS = [
  { text: 'How did we do this week?', icon: '📈' },
  { text: 'Pending deliverables?', icon: '📋' },
  { text: 'Change my plan', icon: '⚖︎' },
  { text: 'Review this invoice', icon: '⧉' },
];

const SCRIPT = [
  {
    user: 'Hey Asaulia, how are sales looking this week?',
    reply: 'Strong week. You\u2019re at $4,230 in attributed sales \u2014 up 14% vs last. Biggest driver is the holiday reel Bruno launched Tuesday.',
    artifacts: [
      { icon: '↗', label: 'Open sales dashboard', meta: '$4,230 · Nov 1–7' },
      { icon: '◐', label: 'See the reel\u2019s performance', meta: 'Bruno · 28k views' },
    ],
  },
  {
    user: 'What\u2019s left on my plate before Friday?',
    reply: 'Four deliverables need your eyes. The homepage rewrite is ready for review \u2014 that one\u2019s time-sensitive.',
    artifacts: [
      { icon: '▦', label: 'Open kanban', meta: '4 awaiting your review' },
    ],
  },
  {
    user: 'I want to move my plan to more variable, less fixed.',
    reply: 'Got it. Dragging you toward the growth end: $199 fixed + 16.8% variable. Change takes effect next cycle, Nov 15.',
    artifacts: [
      { icon: '⚖︎', label: 'Adjust plan slider', meta: 'Preview & confirm' },
    ],
  },
];

function VoiceApp() {
  const [state, setState] = useState('idle'); // idle | listening | thinking | speaking | artifact
  const [turn, setTurn] = useState(null); // current SCRIPT index
  const [shownUser, setShownUser] = useState('');
  const [shownReply, setShownReply] = useState('');
  const typingRef = useRef(null);

  function runTurn(idx) {
    const t = SCRIPT[idx];
    setTurn(idx);
    setShownUser('');
    setShownReply('');
    setState('listening');

    // Type out user speech
    let i = 0;
    clearInterval(typingRef.current);
    typingRef.current = setInterval(() => {
      i++;
      setShownUser(t.user.slice(0, i));
      if (i >= t.user.length) {
        clearInterval(typingRef.current);
        setTimeout(() => setState('thinking'), 400);
        setTimeout(() => {
          setState('speaking');
          // Type reply
          let j = 0;
          typingRef.current = setInterval(() => {
            j++;
            setShownReply(t.reply.slice(0, j));
            if (j >= t.reply.length) {
              clearInterval(typingRef.current);
              setTimeout(() => setState('artifact'), 300);
            }
          }, 18);
        }, 1200);
      }
    }, 28);
  }

  function reset() {
    clearInterval(typingRef.current);
    setTurn(null);
    setState('idle');
    setShownUser('');
    setShownReply('');
  }

  useEffect(() => () => clearInterval(typingRef.current), []);

  const current = turn != null ? SCRIPT[turn] : null;

  return (
    <div className="voice-shell">
      <div className="voice-halo-backdrop" />

      <TopBar onClose={reset} />

      <div className="voice-stage">
        {turn != null && (
          <VoiceTranscript user={shownUser} reply={state === 'speaking' || state === 'artifact' ? shownReply : ''} />
        )}

        <div className="orb-wrap">
          <VoiceOrb state={state === 'artifact' ? 'idle' : state} size={120} />
          <div style={{ marginTop: 18 }}><VoiceStatus state={state === 'artifact' ? 'idle' : state} /></div>
        </div>

        {state === 'artifact' && current && (
          <div className="artifact-rack">
            {current.artifacts.map((a, i) => (
              <ArtifactShortcut key={i} icon={a.icon} label={a.label} meta={a.meta} onOpen={() => {}} />
            ))}
          </div>
        )}

        {state === 'idle' && turn == null && (
          <div className="suggestion-rack">
            <p className="suggestion-prompt">How can I move the needle today?</p>
            <div className="suggestion-row">
              {SUGGESTIONS.map((s, i) => (
                <SuggestionChip key={i} onClick={() => runTurn(i % SCRIPT.length)}>
                  <span className="chip-icon">{s.icon}</span>
                  <span>{s.text}</span>
                </SuggestionChip>
              ))}
            </div>
          </div>
        )}

        {state === 'idle' && turn != null && (
          <button className="try-another" onClick={() => runTurn((turn + 1) % SCRIPT.length)}>Ask another</button>
        )}
      </div>

      <div className="voice-footer">
        <span>Hold space to talk · tap a suggestion to demo</span>
      </div>
    </div>
  );
}

window.VoiceApp = VoiceApp;
