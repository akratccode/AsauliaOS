/* globals React */
const { useEffect, useState } = React;

/**
 * VoiceOrb — the signature breathing mic orb.
 * Props:
 *   state: 'idle' | 'listening' | 'thinking' | 'speaking'
 *   size:  number (px) — default 96
 */
function VoiceOrb({ state = 'idle', size = 96 }) {
  const mic = (
    <svg width={size * 0.28} height={size * 0.28} viewBox="0 0 24 24" fill="none" stroke="#0B1020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10v2a7 7 0 0 0 14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  );

  return (
    <div className={`voice-orb state-${state}`} style={{ width: size, height: size }}>
      <div className="orb-halo-1" />
      <div className="orb-halo-2" />
      <div className="orb-halo-3" />
      <div className="orb-core">
        {state === 'thinking' ? (
          <div className="orb-swirl" />
        ) : state === 'speaking' ? (
          <div className="orb-eq">
            <span/><span/><span/><span/>
          </div>
        ) : mic}
      </div>
    </div>
  );
}

window.VoiceOrb = VoiceOrb;
