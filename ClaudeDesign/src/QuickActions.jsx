// QuickActions — 자주 쓰는 기능 모음 (favorites, command-palette style)
// Items shown are sourced from enabledQuicks (registered in Settings).
function QuickActions({ onClose, onPick, enabledQuicks = [], onOpenSettings }) {
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef(null);
  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const catalog = window.QUICK_FEATURES || [];
  const pinned = enabledQuicks
    .map(id => catalog.find(f => f.id === id))
    .filter(Boolean)
    .filter(f => !q.trim() || f.label.toLowerCase().includes(q.toLowerCase()) || f.desc.toLowerCase().includes(q.toLowerCase()));

  const recent = [
    { icon: <I.Bolt size={14}/>,    label: '오늘 주요 뉴스 3개', shortcut: '⌘ 1' },
    { icon: <I.Pen size={14}/>,     label: '슬랙 메시지 정리해줘', shortcut: '⌘ 2' },
    { icon: <I.Folder size={14}/>,  label: '다운로드 폴더 정리', shortcut: '⌘ 3' },
    { icon: <I.Brain size={14}/>,   label: '디자인 시스템 토큰 설명', shortcut: '⌘ 4' },
  ];

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'oklch(0.2 0 0 / 0.18)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center',
      animation: 'fade 200ms var(--ease)',
    }}>
      <div onClick={e => e.stopPropagation()} className="glass-strong" style={{
        width: 640, maxHeight: '80vh', overflow: 'hidden',
        animation: 'scaleIn 240ms var(--ease)',
        display: 'flex', flexDirection: 'column', padding: 0,
      }}>
        {/* search */}
        <div style={{
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid var(--hairline)',
        }}>
          <I.Search size={18} style={{ color: 'var(--ink-3)' }}/>
          <input
            ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="기능 찾기 또는 명령어 입력…"
            style={{
              flex: 1, fontSize: 16, background: 'transparent', border: 0, outline: 'none',
              letterSpacing: -0.01,
            }}
          />
          <kbd style={{
            padding: '3px 8px', borderRadius: 6, fontSize: 11,
            background: 'oklch(1 0 0 / 0.6)', boxShadow: 'inset 0 0 0 1px var(--hairline)',
            color: 'var(--ink-3)', fontFamily: '"JetBrains Mono", monospace',
          }}>esc</kbd>
        </div>

        <div className="scroll" style={{ overflowY: 'auto', padding: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10, paddingLeft: 4,
          }}>
            <div style={{
              fontSize: 11, color: 'var(--ink-3)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.4,
            }}>등록된 기능 · {enabledQuicks.length}개</div>
            <button
              onClick={onOpenSettings}
              style={{
                fontSize: 11.5, color: 'var(--accent-ink)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: 'var(--accent-soft)',
              }}
            ><I.Settings size={11}/> 설정에서 관리</button>
          </div>

          {pinned.length === 0 ? (
            <div style={{
              padding: '28px 16px', borderRadius: 16,
              background: 'oklch(1 0 0 / 0.55)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
              textAlign: 'center',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, margin: '0 auto 12px',
                background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                display: 'grid', placeItems: 'center',
              }}><I.Sparkles size={20}/></div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {q.trim() ? '검색 결과가 없어요' : '등록된 기능이 없어요'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14, lineHeight: 1.55 }}>
                {q.trim()
                  ? '다른 키워드로 검색해보세요.'
                  : '설정에서 자주 쓰는 기능을 등록하면 여기에 나타나요.'}
              </div>
              {!q.trim() && (
                <button onClick={onOpenSettings} style={{
                  padding: '8px 14px', borderRadius: 99, fontSize: 12.5, color: 'white',
                  background: 'var(--accent)', fontWeight: 500,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <I.Plus size={13}/> 기능 등록하러 가기
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            }}>
              {pinned.map((p, i) => {
                const iconEl = I[p.icon]?.({ size: 18 });
                return (
                  <button key={p.id} onClick={() => onPick?.(p)} style={{
                    padding: 14, borderRadius: 16,
                    background: 'oklch(1 0 0 / 0.55)',
                    boxShadow: 'inset 0 0 0 1px var(--hairline)',
                    textAlign: 'left',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    transition: 'all 180ms var(--ease)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'oklch(1 0 0 / 0.85)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'oklch(1 0 0 / 0.55)'; e.currentTarget.style.transform = 'none'; }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      display: 'grid', placeItems: 'center',
                      background: p.accent,
                      color: 'oklch(0.25 0.05 50)',
                    }}>{iconEl}</div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{p.hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {pinned.length > 0 && !q.trim() && (
            <>
              <div style={{
                fontSize: 11, color: 'var(--ink-3)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.4,
                marginTop: 18, marginBottom: 10, paddingLeft: 4,
              }}>최근 사용</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recent.map((r, i) => (
                  <button key={i} style={{
                    padding: '10px 12px', borderRadius: 10,
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 13.5, color: 'var(--ink)',
                    transition: 'background 140ms var(--ease)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / 0.5)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: 'var(--ink-3)' }}>{r.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{r.label}</span>
                    <kbd style={{
                      fontSize: 10.5, color: 'var(--ink-3)', fontFamily: '"JetBrains Mono", monospace',
                    }}>{r.shortcut}</kbd>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--hairline)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11.5, color: 'var(--ink-3)',
        }}>
          <span>음성으로 실행하려면 마이크 버튼</span>
          <span><kbd style={{ fontFamily: '"JetBrains Mono", monospace' }}>↵</kbd> 실행 · <kbd style={{ fontFamily: '"JetBrains Mono", monospace' }}>⌘,</kbd> 설정</span>
        </div>
      </div>
    </div>
  );
}

window.QuickActions = QuickActions;
