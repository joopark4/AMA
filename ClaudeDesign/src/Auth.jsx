// Auth screen — Google OAuth + Terms
function AuthScreen({ onDone }) {
  const [showTerms, setShowTerms] = React.useState(false);
  const [agreed, setAgreed] = React.useState({ tos: false, privacy: false });
  const allAgreed = agreed.tos && agreed.privacy;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div className="desktop-bg"/>
      <div style={{ position: 'relative', textAlign: 'center', width: 420 }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 20 }}>
          <Avatar state="idle" size={160}/>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.03, marginBottom: 8 }}>
          AMA에 오신 걸 환영해요
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 36 }}>
          데스크톱 위에서 항상 함께하는 AI 컴패니언.<br/>
          시작하려면 계정으로 로그인해주세요.
        </p>

        {!showTerms ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => setShowTerms(true)} className="glass-strong" style={{
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              fontSize: 14.5, fontWeight: 600,
              background: 'oklch(1 0 0 / 0.95)', borderRadius: 14,
            }}>
              <I.Google size={20}/> Google로 계속하기
            </button>
            <button disabled className="glass" style={{
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              fontSize: 14.5, fontWeight: 600, color: 'var(--ink-3)',
              borderRadius: 14, cursor: 'not-allowed',
            }}>
              <I.Apple size={20}/> Apple로 계속하기 <span style={{
                fontSize: 11, padding: '2px 7px', borderRadius: 99,
                background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 600,
              }}>곧</span>
            </button>
            <button onClick={onDone} style={{
              padding: 12, marginTop: 4,
              fontSize: 13, color: 'var(--ink-3)',
            }}>로그인 없이 둘러보기</button>
          </div>
        ) : (
          <div className="glass-strong" style={{ padding: 24, textAlign: 'left', animation: 'scaleIn 220ms var(--ease)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>약관 동의</h3>
            {[
              { k: 'tos',     l: '이용약관',         link: '읽기' },
              { k: 'privacy', l: '개인정보처리방침',  link: '읽기' },
            ].map(item => (
              <label key={item.k} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                background: 'oklch(1 0 0 / 0.55)',
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
                marginBottom: 8, cursor: 'pointer',
              }}>
                <button onClick={() => setAgreed(a => ({ ...a, [item.k]: !a[item.k] }))} style={{
                  width: 22, height: 22, borderRadius: 7,
                  background: agreed[item.k] ? 'var(--accent)' : 'oklch(1 0 0 / 0.7)',
                  boxShadow: agreed[item.k] ? 'none' : 'inset 0 0 0 1.5px var(--hairline-strong)',
                  display: 'grid', placeItems: 'center', color: 'white',
                  transition: 'all 160ms var(--ease)',
                }}>{agreed[item.k] && <I.Check size={14}/>}</button>
                <span style={{ flex: 1, fontSize: 13.5 }}>{item.l} <span style={{ color: 'var(--danger)' }}>*</span></span>
                <a style={{ fontSize: 12, color: 'var(--accent-ink)', textDecoration: 'underline' }}>{item.link}</a>
              </label>
            ))}
            <button disabled={!allAgreed} onClick={onDone} style={{
              width: '100%', padding: 12, marginTop: 8,
              borderRadius: 12, fontSize: 14.5, fontWeight: 600,
              background: allAgreed ? 'var(--accent)' : 'oklch(0.88 0.01 60)',
              color: allAgreed ? 'white' : 'var(--ink-3)',
              transition: 'all 200ms var(--ease)',
            }}>동의하고 시작하기</button>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 28, lineHeight: 1.6 }}>
          BSD 2-Clause 라이선스 · macOS 14+ · Apple Silicon
        </p>
      </div>
    </div>
  );
}

window.AuthScreen = AuthScreen;
