// Marketing landing page
function Landing() {
  return (
    <div className="scroll" style={{
      position: 'absolute', inset: 0, overflowY: 'auto',
      background: 'var(--bg)',
    }}>
      {/* hero */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'grid', placeItems: 'center', padding: '80px 60px 60px',
        background: `
          radial-gradient(900px 600px at 18% 20%, oklch(0.92 0.05 50 / 0.6), transparent 60%),
          radial-gradient(800px 700px at 82% 80%, oklch(0.90 0.06 320 / 0.5), transparent 65%),
          var(--bg)`,
      }}>
        <nav style={{
          position: 'absolute', top: 72, left: 60, right: 60,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent), var(--glow))',
              boxShadow: '0 4px 14px oklch(0.74 0.14 45 / 0.35)',
            }}/>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.02 }}>AMA</div>
          </div>
          <div style={{ display: 'flex', gap: 28, fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500 }}>
            <a>특징</a><a>프리미엄</a><a>다운로드</a><a>GitHub</a>
          </div>
          <button style={{
            padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
            background: 'var(--ink)', color: 'white',
          }}>무료로 시작</button>
        </nav>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 60, alignItems: 'center', maxWidth: 1180, width: '100%' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', borderRadius: 99,
              background: 'oklch(1 0 0 / 0.7)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
              fontSize: 11.5, color: 'var(--accent-ink)', fontWeight: 600, marginBottom: 20,
              textTransform: 'uppercase', letterSpacing: 0.4,
            }}><I.Sparkles size={12}/> v0.8 출시</div>
            <h1 style={{
              fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -0.035,
              marginBottom: 20,
            }}>
              내 책상 위에<br/>
              <span style={{
                background: 'linear-gradient(120deg, var(--accent) 30%, var(--glow))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>작은 친구</span> 한 명.
            </h1>
            <p style={{
              fontSize: 18, color: 'var(--ink-2)', lineHeight: 1.55, maxWidth: 480,
              marginBottom: 32,
            }}>
              화면 위 어디든 머무는 AI 컴패니언. 음성으로 부르고 텍스트로 묻고, 답은 자연스러운 음성으로 돌아와요. 모든 걸 내 맥에서, 오프라인으로.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button style={{
                padding: '14px 22px', borderRadius: 14, fontSize: 14.5, fontWeight: 600,
                background: 'var(--ink)', color: 'white',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 24px oklch(0.2 0.012 50 / 0.25)',
              }}><I.Apple size={18}/> macOS용 다운로드</button>
              <button style={{
                padding: '14px 18px', borderRadius: 14, fontSize: 14, color: 'var(--ink-2)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}><I.Play size={14}/> 1분 데모 보기</button>
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 32, fontSize: 12, color: 'var(--ink-3)' }}>
              <span>✓ Apple Silicon 최적화</span>
              <span>✓ 100% 로컬 처리</span>
              <span>✓ BSD 2-Clause</span>
            </div>
          </div>

          {/* hero device mock */}
          <div style={{ position: 'relative', aspectRatio: '4/3' }}>
            <div className="glass-strong" style={{
              position: 'absolute', inset: 0, borderRadius: 28, overflow: 'hidden',
              background: 'linear-gradient(180deg, oklch(0.96 0.01 60), oklch(0.93 0.015 60))',
            }}>
              {/* fake mac chrome */}
              <div style={{
                padding: '12px 14px', display: 'flex', gap: 7, alignItems: 'center',
                borderBottom: '1px solid var(--hairline)',
                background: 'oklch(1 0 0 / 0.4)',
              }}>
                {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                  <div key={c} style={{ width: 11, height: 11, borderRadius: 99, background: c }}/>
                ))}
              </div>
              <div style={{ position: 'relative', height: 'calc(100% - 36px)' }}>
                <div style={{
                  position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%, -50%)',
                }}>
                  <Avatar state="speaking" size={170}/>
                </div>
                {/* mini speech bubble */}
                <div style={{
                  position: 'absolute', left: '50%', top: '8%', transform: 'translateX(-50%)',
                  padding: '8px 14px', borderRadius: 16,
                  background: 'oklch(1 0 0 / 0.92)',
                  boxShadow: 'inset 0 0 0 1px var(--hairline), 0 4px 12px oklch(0.2 0 0 / 0.06)',
                  fontSize: 12, fontWeight: 500,
                }}>오늘은 미팅이 두 개 있어요 🎈</div>
                {/* mini cluster */}
                <div style={{
                  position: 'absolute', right: 16, bottom: 16,
                  padding: 4, borderRadius: 99,
                  background: 'oklch(1 0 0 / 0.85)',
                  boxShadow: 'inset 0 0 0 1px var(--hairline), 0 4px 14px oklch(0.2 0 0 / 0.08)',
                  display: 'flex', gap: 4,
                }}>
                  {[<I.Sparkles size={13}/>, <I.History size={13}/>, <I.Mic size={15}/>, <I.Settings size={13}/>].map((ic, i) => (
                    <div key={i} style={{
                      width: i === 2 ? 32 : 26, height: i === 2 ? 32 : 26, borderRadius: 99,
                      display: 'grid', placeItems: 'center',
                      background: i === 2 ? 'var(--accent)' : 'transparent',
                      color: i === 2 ? 'white' : 'var(--ink-2)',
                    }}>{ic}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section style={{ padding: '100px 60px', maxWidth: 1180, margin: '0 auto' }}>
        <h2 style={{ fontSize: 40, fontWeight: 700, letterSpacing: -0.03, marginBottom: 12, maxWidth: 700 }}>
          데스크톱을 비우지 않고도, 모든 걸 물어볼 수 있어요.
        </h2>
        <p style={{ fontSize: 16, color: 'var(--ink-2)', maxWidth: 560, marginBottom: 48, lineHeight: 1.55 }}>
          투명한 오버레이로 어떤 작업 위에서도 함께. 단축키 한 번이면 음성으로 부를 수 있어요.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {[
            { icon: <I.Mic/>,    t: '온디바이스 음성',     d: 'Whisper로 알아듣고 Supertonic으로 답해요. 인터넷 없이도.', glow: 'oklch(0.85 0.10 50)' },
            { icon: <I.Brain/>,  t: '내 LLM 그대로',      d: 'Claude · OpenAI · Gemini · Ollama 무엇이든 연결해서 써요.', glow: 'oklch(0.85 0.10 320)' },
            { icon: <I.Cube/>,   t: 'VRM 아바타',         d: '직접 만든 캐릭터를 화면 위에 띄우고 말 시켜보세요.',      glow: 'oklch(0.85 0.10 200)' },
            { icon: <I.Bolt/>,   t: '단축키 한 방',       d: 'Cmd+Shift+Space로 어디서든 호출.',                       glow: 'oklch(0.85 0.10 70)' },
            { icon: <I.Lock/>,   t: '내 데이터는 내 맥에', d: '대화·VRM·녹음 전부 로컬 저장. 원할 때 한 번에 삭제.',     glow: 'oklch(0.85 0.10 140)' },
            { icon: <I.Code/>,   t: 'Claude Code 연동',   d: '터미널의 Claude Code와 양방향 채널로 음성 코딩까지.',    glow: 'oklch(0.85 0.10 25)' },
          ].map((f, i) => (
            <div key={i} className="glass" style={{ padding: 26, borderRadius: 22 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, marginBottom: 18,
                display: 'grid', placeItems: 'center',
                background: f.glow, color: 'oklch(0.25 0.05 50)',
              }}>{f.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, letterSpacing: -0.015 }}>{f.t}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '60px 60px 100px' }}>
        <div className="glass-strong" style={{
          maxWidth: 1180, margin: '0 auto', padding: '48px 56px',
          background: 'linear-gradient(135deg, oklch(0.95 0.04 50 / 0.7), oklch(0.93 0.05 320 / 0.6))',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 40,
        }}>
          <div>
            <h3 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.025, marginBottom: 8 }}>
              지금 무료로 받아서 같이 시작해요
            </h3>
            <p style={{ fontSize: 14.5, color: 'var(--ink-2)', maxWidth: 480 }}>
              VRM 파일만 있으면 됩니다. 없으면 기본 아바타로 바로 시작 가능해요.
            </p>
          </div>
          <button style={{
            padding: '16px 28px', borderRadius: 14, fontSize: 15, fontWeight: 600,
            background: 'var(--ink)', color: 'white',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}><I.Apple size={18}/> 다운로드</button>
        </div>
      </section>

      <footer style={{
        padding: '24px 60px', borderTop: '1px solid var(--hairline)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'var(--ink-3)',
      }}>
        <span>© 2026 AMA · BSD 2-Clause</span>
        <span>made by joopark4 · Apple Silicon only</span>
      </footer>
    </div>
  );
}

window.Landing = Landing;
