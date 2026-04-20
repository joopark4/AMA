// Onboarding — 3 step: model download → VRM pick → avatar name
function Onboarding({ onDone }) {
  const [step, setStep] = React.useState(0);
  const [progress, setProgress] = React.useState({ supertonic: 0, whisper: 0 });
  const [vrm, setVrm] = React.useState(null);
  const [name, setName] = React.useState('');

  React.useEffect(() => {
    if (step !== 0) return;
    let id = setInterval(() => {
      setProgress(p => {
        const s = Math.min(100, p.supertonic + 4 + Math.random() * 5);
        const w = Math.min(100, p.whisper + (s > 30 ? 3 + Math.random() * 4 : 0));
        return { supertonic: s, whisper: w };
      });
    }, 220);
    return () => clearInterval(id);
  }, [step]);

  const downloadDone = progress.supertonic >= 100 && progress.whisper >= 100;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'auto' }}>
      <div className="desktop-bg"/>
      <div style={{ position: 'relative', width: 560, padding: '48px 0' }}>
        {/* progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: i === step ? 28 : 8, height: 8, borderRadius: 99,
              background: i <= step ? 'var(--accent)' : 'oklch(0.85 0.005 60)',
              transition: 'all 280ms var(--ease)',
            }}/>
          ))}
        </div>

        <div className="glass-strong" style={{ padding: 36, animation: 'scaleIn 280ms var(--ease)' }}>
          {step === 0 && (
            <div>
              <div style={{ display: 'grid', placeItems: 'center', marginBottom: 20 }}>
                <Avatar state="thinking" size={140}/>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.02, textAlign: 'center', marginBottom: 8 }}>
                필요한 모델을 준비하고 있어요
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
                음성 인식과 합성을 로컬에서 실행하기 위한 모델이에요.<br/>
                한 번만 받아두면 인터넷 없이도 사용할 수 있어요.
              </p>
              <DownloadRow name="Supertonic TTS" sub="음성 합성 · 250MB" pct={progress.supertonic}/>
              <DownloadRow name="Whisper base" sub="음성 인식 · 141MB" pct={progress.whisper}/>
              <button
                disabled={!downloadDone}
                onClick={() => setStep(1)}
                style={{
                  width: '100%', marginTop: 24, padding: '12px',
                  borderRadius: 12, fontSize: 14.5, fontWeight: 600,
                  background: downloadDone ? 'var(--accent)' : 'oklch(0.88 0.01 60)',
                  color: downloadDone ? 'white' : 'var(--ink-3)',
                  transition: 'all 200ms var(--ease)',
                }}>
                {downloadDone ? '다음으로' : '받는 중…'}
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.02, marginBottom: 6 }}>
                아바타를 선택해주세요
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
                기본 아바타로 시작하거나 직접 만든 .vrm 파일을 불러올 수 있어요.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {['eunyeon', 'haru', 'mio'].map(v => (
                  <button key={v} onClick={() => setVrm(v)} style={{
                    aspectRatio: '1', borderRadius: 16,
                    background: vrm === v ? 'var(--accent-soft)' : 'oklch(1 0 0 / 0.55)',
                    boxShadow: vrm === v
                      ? 'inset 0 0 0 2px var(--accent)'
                      : 'inset 0 0 0 1px var(--hairline)',
                    display: 'grid', placeItems: 'center', position: 'relative',
                    transition: 'all 180ms var(--ease)',
                  }}>
                    <Avatar state="idle" size={96}/>
                    <div style={{
                      position: 'absolute', bottom: 8, fontSize: 12, fontWeight: 500,
                      color: 'var(--ink-2)',
                    }}>{v}</div>
                  </button>
                ))}
              </div>
              <button style={{
                width: '100%', padding: 12, borderRadius: 12, fontSize: 13.5,
                background: 'oklch(1 0 0 / 0.55)',
                boxShadow: 'inset 0 0 0 1px var(--hairline-strong)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: 'var(--ink-2)',
              }}><I.Plus size={16}/> 내 .vrm 파일 불러오기</button>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setStep(0)} style={{
                  padding: '12px 20px', borderRadius: 12, fontSize: 14, color: 'var(--ink-2)',
                  background: 'oklch(1 0 0 / 0.55)', boxShadow: 'inset 0 0 0 1px var(--hairline)',
                }}>이전</button>
                <button disabled={!vrm} onClick={() => setStep(2)} style={{
                  flex: 1, padding: 12, borderRadius: 12, fontSize: 14.5, fontWeight: 600,
                  background: vrm ? 'var(--accent)' : 'oklch(0.88 0.01 60)',
                  color: vrm ? 'white' : 'var(--ink-3)',
                }}>다음으로</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.02, marginBottom: 6 }}>
                이름을 지어주세요
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 24 }}>
                "AMA야" 라고 부르는 대신 더 가깝게 불러보세요.
              </p>
              <input
                value={name} onChange={e => setName(e.target.value)} maxLength={40}
                placeholder="예: 은연, 하루, 미오…"
                autoFocus
                style={{
                  width: '100%', padding: '14px 16px',
                  borderRadius: 14, border: 0, outline: 'none',
                  background: 'oklch(1 0 0 / 0.7)',
                  boxShadow: 'inset 0 0 0 1px var(--hairline-strong)',
                  fontSize: 18, letterSpacing: -0.01,
                  textAlign: 'center', fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setStep(1)} style={{
                  padding: '12px 20px', borderRadius: 12, fontSize: 14, color: 'var(--ink-2)',
                  background: 'oklch(1 0 0 / 0.55)', boxShadow: 'inset 0 0 0 1px var(--hairline)',
                }}>이전</button>
                <button disabled={!name.trim()} onClick={onDone} style={{
                  flex: 1, padding: 12, borderRadius: 12, fontSize: 14.5, fontWeight: 600,
                  background: name.trim() ? 'var(--accent)' : 'oklch(0.88 0.01 60)',
                  color: name.trim() ? 'white' : 'var(--ink-3)',
                }}>시작하기</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DownloadRow({ name, sub, pct }) {
  const done = pct >= 100;
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12,
      background: 'oklch(1 0 0 / 0.55)',
      boxShadow: 'inset 0 0 0 1px var(--hairline)',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{sub}</div>
        </div>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: done ? 'var(--ok)' : 'var(--accent-ink)',
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          {done ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><I.Check size={13}/> 완료</span> : Math.floor(pct) + '%'}
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: 'oklch(0.9 0.005 60)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: pct + '%',
          background: done ? 'var(--ok)' : 'linear-gradient(90deg, var(--accent), var(--glow))',
          borderRadius: 99,
          transition: 'width 220ms var(--ease)',
        }}/>
      </div>
    </div>
  );
}

window.Onboarding = Onboarding;
