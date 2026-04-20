// Avatar — glowing aura representation of the VRM presence.
// States: idle, listening, thinking, speaking
function Avatar({ state = 'idle', size = 240, name = '은연' }) {
  const auraColor = {
    idle:      'oklch(0.85 0.10 50)',
    listening: 'oklch(0.82 0.13 320)',
    thinking:  'oklch(0.85 0.10 280)',
    speaking:  'oklch(0.82 0.13 25)',
  }[state];

  return (
    <div style={{
      position: 'relative', width: size, height: size,
      display: 'grid', placeItems: 'center',
      pointerEvents: 'none',
    }}>
      {/* outer soft glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 50%, ${auraColor} 0%, transparent 62%)`,
        filter: 'blur(18px)',
        animation: 'auraBreath 3.4s ease-in-out infinite',
        transition: 'background 600ms var(--ease)',
      }} />
      {/* inner glow */}
      <div style={{
        position: 'absolute', width: '62%', height: '62%',
        background: `radial-gradient(circle, oklch(1 0 0 / 0.85) 0%, ${auraColor} 55%, transparent 78%)`,
        filter: 'blur(8px)',
        animation: 'auraBreath 2.6s ease-in-out infinite',
      }} />
      {/* core orb */}
      <div style={{
        position: 'relative', width: '38%', height: '38%',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, oklch(1 0 0 / 0.95), oklch(0.94 0.04 60 / 0.85) 55%, oklch(0.86 0.08 50 / 0.7))`,
        boxShadow: `inset 0 -8px 18px oklch(0.7 0.10 40 / 0.4), inset 0 4px 10px oklch(1 0 0 / 0.7), 0 8px 30px ${auraColor}`,
      }}>
        {/* sparkle */}
        <div style={{
          position: 'absolute', top: '18%', left: '22%',
          width: '14%', height: '14%', borderRadius: '50%',
          background: 'oklch(1 0 0 / 0.85)', filter: 'blur(2px)',
        }} />
      </div>

      {/* listening rings */}
      {state === 'listening' && (
        <>
          {[0, 0.6, 1.2].map((d, i) => (
            <div key={i} style={{
              position: 'absolute', width: '50%', height: '50%',
              borderRadius: '50%',
              border: `1.5px solid ${auraColor}`,
              animation: `ringPulse 2s ease-out ${d}s infinite`,
            }} />
          ))}
        </>
      )}
    </div>
  );
}

window.Avatar = Avatar;
