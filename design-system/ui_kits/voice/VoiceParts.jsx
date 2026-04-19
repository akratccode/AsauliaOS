/* globals React */

function VoiceStatus({ state }) {
  const label = {
    idle: 'Tap to speak',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Asaulia',
  }[state] || state;

  return (
    <div className={`voice-status state-${state}`}>
      {state === 'listening' && <span className="status-dot" />}
      <span className="status-label">{label}</span>
    </div>
  );
}

function SuggestionChip({ children, onClick }) {
  return <button className="suggestion-chip" onClick={onClick}>{children}</button>;
}

function ArtifactShortcut({ icon, label, meta, onOpen }) {
  return (
    <button className="artifact-shortcut" onClick={onOpen}>
      <span className="artifact-icon">{icon}</span>
      <span className="artifact-text">
        <span className="artifact-label">{label}</span>
        {meta && <span className="artifact-meta">{meta}</span>}
      </span>
      <svg className="artifact-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
    </button>
  );
}

function VoiceTranscript({ user, reply }) {
  return (
    <div className="voice-transcript">
      {user && <p className="voice-user">{user}</p>}
      {reply && <p className="voice-reply">{reply}</p>}
    </div>
  );
}

function TopBar({ brand = 'Lumen Coffee', onClose }) {
  return (
    <div className="voice-topbar">
      <button className="brand-switch">
        <span className="brand-avatar">L</span>
        <span>{brand}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <button className="voice-close" onClick={onClose} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

Object.assign(window, { VoiceStatus, SuggestionChip, ArtifactShortcut, VoiceTranscript, TopBar });
