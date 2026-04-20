// Settings panel — slide-in right
function SettingsSection({ icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{
      borderRadius: 18,
      background: 'oklch(1 0 0 / 0.55)',
      boxShadow: 'inset 0 0 0 1px var(--hairline)',
      overflow: 'hidden',
      transition: 'all 200ms var(--ease)',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          textAlign: 'left',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          display: 'grid', placeItems: 'center',
          background: 'var(--accent-soft)', color: 'var(--accent-ink)',
        }}>{icon}</div>
        <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, letterSpacing: -0.01 }}>{title}</div>
        <div style={{
          color: 'var(--ink-3)',
          transition: 'transform 240ms var(--ease)',
          transform: `rotate(${open ? 180 : 0}deg)`,
        }}><I.ChevDown size={16}/></div>
      </button>
      {open && (
        <div style={{
          padding: '4px 16px 18px', animation: 'fade 220ms var(--ease)',
        }}>{children}</div>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Select({ value, options, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value} onChange={e => onChange?.(e.target.value)}
        style={{
          width: '100%', padding: '9px 32px 9px 12px',
          fontSize: 13.5,
          borderRadius: 10,
          border: 0,
          background: 'oklch(1 0 0 / 0.7)',
          boxShadow: 'inset 0 0 0 1px var(--hairline)',
          appearance: 'none', WebkitAppearance: 'none',
          color: 'var(--ink)',
          fontFamily: 'inherit',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--ink-3)', pointerEvents: 'none',
      }}><I.ChevDown size={14}/></div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder, mono }) {
  return (
    <input
      value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
      className="focus-ring"
      style={{
        width: '100%', padding: '9px 12px',
        fontSize: 13.5,
        borderRadius: 10,
        border: 0,
        background: 'oklch(1 0 0 / 0.7)',
        boxShadow: 'inset 0 0 0 1px var(--hairline)',
        outline: 'none',
        fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit',
      }}
    />
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange?.(!on)}
      style={{
        width: 38, height: 22, borderRadius: 99,
        background: on ? 'var(--accent)' : 'oklch(0.85 0.005 60)',
        position: 'relative',
        transition: 'background 200ms var(--ease)',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: 'white',
        boxShadow: '0 1px 2px oklch(0.2 0 0 / 0.2)',
        transition: 'left 220ms var(--ease)',
      }}/>
    </button>
  );
}

function Row({ label, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0',
    }}>
      <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{label}</div>
      {children}
    </div>
  );
}

function Slider({ value, min = 0, max = 100, onChange, format = (v) => v }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange?.(+e.target.value)}
        style={{ flex: 1, accentColor: 'oklch(0.74 0.14 45)' }}
      />
      <div style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 36, textAlign: 'right',
        fontFamily: '"JetBrains Mono", monospace' }}>{format(value)}</div>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 99,
      fontSize: 12.5, fontWeight: 500,
      background: active ? 'var(--accent)' : 'oklch(1 0 0 / 0.7)',
      color: active ? 'white' : 'var(--ink-2)',
      boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--hairline)',
      transition: 'all 160ms var(--ease)',
    }}>{children}</button>
  );
}

function SettingsPanel({ onClose, tweaks, setTweaks, enabledQuicks = [], setEnabledQuicks }) {
  const [provider, setProvider] = React.useState('claude');
  const [stt, setStt] = React.useState('base');
  const [voice, setVoice] = React.useState('F2');
  const [lang, setLang] = React.useState('ko');
  const [shortcut, setShortcut] = React.useState(true);
  const [shortcutKey, setShortcutKey] = React.useState('⌘ + ⇧ + Space');
  const [freeMove, setFreeMove] = React.useState(true);
  const [bubble, setBubble] = React.useState(true);
  const [channels, setChannels] = React.useState(false);

  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'oklch(0.2 0 0 / 0.16)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        animation: 'fade 200ms var(--ease)', zIndex: 40,
      }}/>
      <div className="glass-strong" style={{
        position: 'absolute', top: 70, right: 12, bottom: 12,
        width: 420, zIndex: 41,
        display: 'flex', flexDirection: 'column',
        animation: 'panelIn 320ms var(--ease)',
        padding: 0, overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{
          padding: '20px 22px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.02 }}>설정</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>AMA를 내 방식대로 다듬기</div>
          </div>
          <button onClick={onClose} className="focus-ring" style={{
            width: 32, height: 32, borderRadius: 99,
            display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
            background: 'oklch(1 0 0 / 0.5)', boxShadow: 'inset 0 0 0 1px var(--hairline)',
          }}><I.Close size={16}/></button>
        </div>

        {/* user pill */}
        <div style={{ padding: '0 22px 14px' }}>
          <div style={{
            padding: '12px 14px', borderRadius: 16,
            background: 'oklch(1 0 0 / 0.55)',
            boxShadow: 'inset 0 0 0 1px var(--hairline)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--glow))',
              display: 'grid', placeItems: 'center', color: 'white', fontWeight: 600,
            }}>주</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>주현 님</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                joopark4@gmail.com · Pro 플랜
              </div>
            </div>
            <button style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 12, color: 'var(--ink-2)',
              background: 'oklch(1 0 0 / 0.6)', boxShadow: 'inset 0 0 0 1px var(--hairline)',
            }}>관리</button>
          </div>
        </div>

        {/* sections */}
        <div className="scroll" style={{
          flex: 1, overflowY: 'auto', padding: '0 22px 22px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <SettingsSection icon={<I.Globe size={16}/>} title="언어">
            <Field label="앱 언어">
              <Select value={lang} onChange={setLang} options={[
                { value: 'ko', label: '한국어' },
                { value: 'en', label: 'English' },
                { value: 'ja', label: '日本語' },
              ]}/>
            </Field>
          </SettingsSection>

          <SettingsSection icon={<I.Brain size={16}/>} title="AI 모델" defaultOpen>
            <Field label="Provider">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { v: 'claude', l: 'Claude' },
                  { v: 'openai', l: 'OpenAI' },
                  { v: 'gemini', l: 'Gemini' },
                  { v: 'ollama', l: 'Ollama (로컬)' },
                  { v: 'localai', l: 'LocalAI' },
                ].map(o => (
                  <Pill key={o.v} active={provider === o.v} onClick={() => setProvider(o.v)}>{o.l}</Pill>
                ))}
              </div>
            </Field>
            <Field label="모델">
              <Select value="claude-sonnet-4-5" options={[
                { value: 'claude-sonnet-4-5', label: 'claude-sonnet-4-5' },
                { value: 'claude-haiku-4-5', label: 'claude-haiku-4-5' },
              ]}/>
            </Field>
            <Field label="API Key" hint="환경변수 우선">
              <TextInput value="sk-ant-•••••••••••••••••dN2k" mono/>
            </Field>
          </SettingsSection>

          <SettingsSection icon={<I.Mic size={16}/>} title="음성 (STT · TTS)">
            <Field label="STT 엔진" hint="Whisper 로컬">
              <div style={{ display: 'flex', gap: 6 }}>
                {['base', 'small', 'medium'].map(s => (
                  <Pill key={s} active={stt === s} onClick={() => setStt(s)}>
                    {s} · {s === 'base' ? '141MB' : s === 'small' ? '465MB' : '1.4GB'}
                  </Pill>
                ))}
              </div>
            </Field>
            <Field label="TTS 음성" hint="Supertonic">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'].map(v => (
                  <Pill key={v} active={voice === v} onClick={() => setVoice(v)}>{v}</Pill>
                ))}
              </div>
            </Field>
            <Row label="음성 미리듣기">
              <button style={{
                padding: '6px 14px', borderRadius: 99, fontSize: 12.5, color: 'white',
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}><I.Play size={12}/> 재생</button>
            </Row>
            <Row label="글로벌 단축키">
              <Toggle on={shortcut} onChange={setShortcut}/>
            </Row>
            {shortcut && (
              <Field label="단축키 조합">
                <div style={{
                  padding: '9px 12px', borderRadius: 10,
                  background: 'oklch(1 0 0 / 0.7)',
                  boxShadow: 'inset 0 0 0 1px var(--hairline)',
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 13,
                  color: 'var(--ink-2)',
                }}>{shortcutKey}</div>
              </Field>
            )}
          </SettingsSection>

          <SettingsSection icon={<I.Cloud size={16}/>} title="프리미엄 음성">
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, padding: '4px 0 10px' }}>
              Supertone API로 더 자연스러운 클라우드 음성. 할당량 소진 시 로컬로 자동 폴백돼요.
            </div>
            <Row label="TTS 엔진">
              <Select value="supertonic" options={[
                { value: 'supertonic', label: 'Supertonic (로컬, 기본)' },
                { value: 'supertone_api', label: 'Supertone API (프리미엄)' },
              ]}/>
            </Row>
          </SettingsSection>

          <SettingsSection icon={<I.Sparkles size={16}/>} title="자주 쓰는 기능">
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, padding: '4px 0 12px' }}>
              자주 사용하는 기능을 등록하면 <span style={{ color: 'var(--accent-ink)', fontWeight: 500 }}>✨ 아이콘</span>에서
              바로 불러올 수 있어요. 음성으로도 호출 가능해요.
            </div>

            {/* feature checklist */}
            <div style={{
              borderRadius: 12,
              background: 'oklch(1 0 0 / 0.55)',
              boxShadow: 'inset 0 0 0 1px var(--hairline)',
              overflow: 'hidden',
            }}>
              {window.QUICK_FEATURES.map((f, i) => {
                const on = enabledQuicks.includes(f.id);
                const toggle = () => {
                  setEnabledQuicks(prev =>
                    prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id]
                  );
                };
                return (
                  <button
                    key={f.id}
                    onClick={toggle}
                    style={{
                      width: '100%', padding: '11px 12px',
                      display: 'flex', alignItems: 'center', gap: 11,
                      textAlign: 'left',
                      borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                      transition: 'background 140ms var(--ease)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / 0.5)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* checkbox */}
                    <div style={{
                      width: 18, height: 18, borderRadius: 6,
                      background: on ? 'var(--accent)' : 'oklch(1 0 0 / 0.8)',
                      boxShadow: on ? 'none' : 'inset 0 0 0 1.5px oklch(0.78 0.005 60)',
                      display: 'grid', placeItems: 'center',
                      transition: 'all 160ms var(--ease)',
                      flexShrink: 0,
                    }}>
                      {on && <I.Check size={12} style={{ color: 'white', strokeWidth: 3 }}/>}
                    </div>
                    {/* icon chip */}
                    <div style={{
                      width: 30, height: 30, borderRadius: 9,
                      display: 'grid', placeItems: 'center',
                      background: f.accent,
                      color: 'oklch(0.25 0.05 50)',
                      flexShrink: 0,
                      opacity: on ? 1 : 0.55,
                      transition: 'opacity 160ms var(--ease)',
                    }}>{I[f.icon]?.({ size: 15 })}</div>
                    {/* label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 1 }}>{f.label}</div>
                      <div style={{
                        fontSize: 11.5, color: 'var(--ink-3)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{f.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* registered preview */}
            <div style={{ marginTop: 14 }}>
              <div style={{
                fontSize: 11, color: 'var(--ink-3)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.4,
                marginBottom: 8, display: 'flex', justifyContent: 'space-between',
              }}>
                <span>등록됨 · {enabledQuicks.length}개</span>
                {enabledQuicks.length > 0 && (
                  <button
                    onClick={() => setEnabledQuicks([])}
                    style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'none', letterSpacing: 0 }}
                  >모두 해제</button>
                )}
              </div>
              {enabledQuicks.length === 0 ? (
                <div style={{
                  padding: '14px 12px', borderRadius: 10,
                  background: 'oklch(0.97 0.01 60 / 0.6)',
                  fontSize: 12, color: 'var(--ink-3)', textAlign: 'center',
                  border: '1px dashed oklch(0.82 0.01 60)',
                }}>
                  아직 등록된 기능이 없어요. 위에서 체크해보세요.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {enabledQuicks.map(id => {
                    const f = window.QUICK_FEATURES.find(x => x.id === id);
                    if (!f) return null;
                    return (
                      <div key={id} style={{
                        padding: '5px 10px 5px 6px', borderRadius: 99,
                        background: 'oklch(1 0 0 / 0.7)',
                        boxShadow: 'inset 0 0 0 1px var(--hairline)',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 12, color: 'var(--ink)',
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 5,
                          display: 'grid', placeItems: 'center',
                          background: f.accent, color: 'oklch(0.25 0.05 50)',
                        }}>{I[f.icon]?.({ size: 11 })}</div>
                        {f.label}
                        <button
                          onClick={() => setEnabledQuicks(prev => prev.filter(x => x !== id))}
                          style={{ color: 'var(--ink-3)', padding: 2, display: 'grid', placeItems: 'center' }}
                          title="제거"
                        ><I.Close size={11}/></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SettingsSection>

          <SettingsSection icon={<I.Cube size={16}/>} title="아바타">
            <Field label="이름">
              <TextInput value={tweaks.avatarName} onChange={(v) => setTweaks(t => ({ ...t, avatarName: v }))}/>
            </Field>
            <Field label="크기">
              <Slider value={tweaks.avatarSize} min={160} max={360}
                onChange={(v) => setTweaks(t => ({ ...t, avatarSize: v }))}
                format={v => v + 'px'}/>
            </Field>
            <Field label="VRM 파일">
              <div style={{
                padding: '12px', borderRadius: 12,
                background: 'oklch(1 0 0 / 0.7)',
                boxShadow: 'inset 0 0 0 1px var(--hairline)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>eunyeon_v3.vrm</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>9.4MB · VRoid</div>
                </div>
                <button style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 12,
                  background: 'oklch(1 0 0 / 0.7)', boxShadow: 'inset 0 0 0 1px var(--hairline)',
                }}>변경</button>
              </div>
            </Field>
            <Row label="자유 이동 모드"><Toggle on={freeMove} onChange={setFreeMove}/></Row>
            <Row label="말풍선 표시"><Toggle on={bubble} onChange={setBubble}/></Row>
          </SettingsSection>

          <SettingsSection icon={<I.Code size={16}/>} title="Claude Code Channels">
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, padding: '4px 0 10px' }}>
              외부 Claude Code 세션과 양방향 연결. 사용자 입력 → Claude Code → TTS 응답.
            </div>
            <Row label="Channels 사용"><Toggle on={channels} onChange={setChannels}/></Row>
            {channels && (
              <Field label="Claude Code 실행 명령어">
                <div style={{
                  padding: 12, borderRadius: 10,
                  background: 'oklch(0.18 0.01 50)', color: 'oklch(0.95 0 0)',
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5,
                  lineHeight: 1.55, position: 'relative',
                }}>
                  claude --dangerously-load-development-channels<br/>
                  &nbsp;&nbsp;server:ama-bridge<br/>
                  &nbsp;&nbsp;--permission-mode bypassPermissions
                </div>
              </Field>
            )}
          </SettingsSection>

          <SettingsSection icon={<I.Download size={16}/>} title="앱 업데이트">
            <Row label={<>현재 버전 <span style={{ color: 'var(--ink-3)' }}>v0.8.0</span></>}>
              <button style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, color: 'var(--accent-ink)',
                background: 'var(--accent-soft)',
              }}>업데이트 확인</button>
            </Row>
          </SettingsSection>
        </div>
      </div>
    </>
  );
}

window.SettingsPanel = SettingsPanel;
