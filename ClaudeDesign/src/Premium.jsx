// Premium voice / subscription UI
function Premium({ onClose }) {
  const [plan, setPlan] = React.useState('pro');
  const plans = [
    { id: 'free',  name: 'Free',  price: '₩0',     credits: '0 크레딧',     mins: '로컬 음성만', highlights: ['Whisper STT 로컬', 'Supertonic 로컬 TTS', 'Ollama / LocalAI'] },
    { id: 'basic', name: 'Basic', price: '₩4,900', credits: '300 크레딧',  mins: '월 약 5분', highlights: ['Supertone API 음성', '감정 자동 매핑', '기본 음성 6종'] },
    { id: 'pro',   name: 'Pro',   price: '₩14,900', credits: '1,200 크레딧', mins: '월 약 20분', highlights: ['Supertone 전체 음성', '클라우드 LLM 우선 처리', 'Channels 무제한', '우선 지원'], featured: true },
  ];

  const usage = { used: 612, total: 1200, days: 12 };

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'oklch(0.2 0 0 / 0.18)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', overflow: 'auto',
      animation: 'fade 200ms var(--ease)',
    }}>
      <div onClick={e => e.stopPropagation()} className="glass-strong" style={{
        width: 880, padding: 0, overflow: 'hidden',
        animation: 'scaleIn 280ms var(--ease)',
        margin: '40px',
      }}>
        {/* hero */}
        <div style={{
          padding: '32px 40px 24px',
          background: 'linear-gradient(135deg, oklch(0.95 0.04 50 / 0.6), oklch(0.93 0.05 320 / 0.5))',
          position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 18, right: 18,
            width: 32, height: 32, borderRadius: 99,
            background: 'oklch(1 0 0 / 0.7)', boxShadow: 'inset 0 0 0 1px var(--hairline)',
            display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
          }}><I.Close size={16}/></button>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 99,
            background: 'oklch(1 0 0 / 0.7)', boxShadow: 'inset 0 0 0 1px var(--hairline)',
            fontSize: 11, color: 'var(--accent-ink)', fontWeight: 600, marginBottom: 12,
            textTransform: 'uppercase', letterSpacing: 0.4,
          }}><I.Sparkles size={12}/> Premium Voice</div>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.025, marginBottom: 6 }}>
            진짜 사람 같은 목소리로 답해줘요
          </h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 560 }}>
            Supertone의 클라우드 음성으로 더 풍부한 감정과 자연스러운 발화를. 할당량을 넘으면 로컬로 자동 폴백돼요.
          </p>
        </div>

        {/* current usage */}
        <div style={{ padding: '20px 40px', borderBottom: '1px solid var(--hairline)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              이번 달 사용량
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{usage.days}일 후 갱신</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', letterSpacing: -0.02 }}>{usage.used}</span>
            <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>/ {usage.total} 크레딧 사용</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'oklch(0.92 0.005 60)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: (usage.used / usage.total * 100) + '%',
              background: 'linear-gradient(90deg, var(--accent), var(--glow))',
              borderRadius: 99,
            }}/>
          </div>
        </div>

        {/* plans */}
        <div style={{ padding: 32, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {plans.map(p => (
            <button key={p.id} onClick={() => setPlan(p.id)} style={{
              textAlign: 'left', padding: 22, borderRadius: 18,
              background: plan === p.id
                ? 'linear-gradient(180deg, oklch(1 0 0 / 0.95), oklch(0.97 0.03 50 / 0.85))'
                : 'oklch(1 0 0 / 0.55)',
              boxShadow: plan === p.id
                ? 'inset 0 0 0 2px var(--accent), 0 4px 18px oklch(0.74 0.14 45 / 0.16)'
                : 'inset 0 0 0 1px var(--hairline)',
              transition: 'all 200ms var(--ease)',
              position: 'relative',
            }}>
              {p.featured && (
                <div style={{
                  position: 'absolute', top: -10, right: 16,
                  padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                  background: 'var(--accent)', color: 'white', letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}>추천</div>
              )}
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 14 }}>
                <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.02 }}>{p.price}</span>
                {p.id !== 'free' && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>/ 월</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 4 }}>{p.credits}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>{p.mins}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.highlights.map(h => (
                  <div key={h} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink)' }}>
                    <I.Check size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}/>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div style={{
          padding: '16px 32px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            언제든 취소 가능 · 영수증은 이메일로 발송돼요
          </div>
          <button style={{
            padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600,
            background: 'var(--accent)', color: 'white',
            boxShadow: '0 4px 14px oklch(0.74 0.14 45 / 0.4)',
          }}>{plan === 'free' ? '현재 플랜' : `${plans.find(p => p.id === plan).name} 플랜으로 시작`}</button>
        </div>
      </div>
    </div>
  );
}

window.Premium = Premium;
