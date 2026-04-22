// Tweaks panel
function TweaksPanel({ tweaks, setTweaks, onClose }) {
  return (
    <div className="glass-strong" style={{
      position: 'fixed', right: 16, bottom: 16, zIndex: 9998,
      width: 280, padding: 16,
      animation: 'scaleIn 220ms var(--ease)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <I.Sparkles size={14} style={{ color: 'var(--accent)' }}/>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.01 }}>Tweaks</div>
        </div>
        <button onClick={onClose} style={{
          width: 24, height: 24, borderRadius: 99, display: 'grid', placeItems: 'center',
          color: 'var(--ink-3)',
        }}><I.Close size={12}/></button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, marginBottom: 6 }}>아바타 이름</div>
          <input value={tweaks.avatarName}
            onChange={e => setTweaks(t => ({ ...t, avatarName: e.target.value }))}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 8,
              border: 0, outline: 'none', fontSize: 12.5,
              background: 'oklch(1 0 0 / 0.7)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
            }}/>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>아바타 크기</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: '"JetBrains Mono", monospace' }}>{tweaks.avatarSize}px</span>
          </div>
          <input type="range" min="160" max="360" value={tweaks.avatarSize}
            onChange={e => setTweaks(t => ({ ...t, avatarSize: +e.target.value }))}
            style={{ width: '100%', accentColor: 'oklch(0.74 0.14 45)' }}/>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, marginBottom: 6 }}>액센트 색조</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { v: 45,  c: 'oklch(0.74 0.14 45)',  l: '피치' },
              { v: 320, c: 'oklch(0.74 0.14 320)', l: '핑크' },
              { v: 240, c: 'oklch(0.74 0.14 240)', l: '인디고' },
              { v: 160, c: 'oklch(0.65 0.14 160)', l: '민트' },
            ].map(o => (
              <button key={o.v} onClick={() => setTweaks(t => ({ ...t, accent: o.v }))}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 8,
                  background: o.c, color: 'white', fontSize: 10.5, fontWeight: 600,
                  boxShadow: tweaks.accent === o.v ? '0 0 0 2px var(--ink)' : 'none',
                }}>{o.l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.TweaksPanel = TweaksPanel;
