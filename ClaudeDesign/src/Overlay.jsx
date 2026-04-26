// Speech bubble + status indicator + bottom-right control cluster
function SpeechBubble({ message, state }) {
  return (
    <div style={{
      position: 'absolute',
      left: '50%', bottom: 'calc(50% + 150px)',
      transform: 'translateX(-50%)',
      maxWidth: 460,
      padding: '14px 18px',
      borderRadius: 22,
      background: 'oklch(1 0 0 / 0.85)',
      backdropFilter: 'blur(28px) saturate(1.6)',
      WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
      boxShadow: 'inset 0 1px 0 var(--top-edge), inset 0 0 0 1px var(--hairline), var(--shadow)',
      animation: 'slideUp 320ms var(--ease)',
      lineHeight: 1.55, fontSize: 15, color: 'var(--ink)',
    }}>
      {state === 'thinking' ? (
        <div style={{ display: 'flex', gap: 6, padding: '4px 6px' }}>
          {[0, 0.16, 0.32].map(d => (
            <div key={d} style={{
              width: 8, height: 8, borderRadius: 99,
              background: 'var(--accent)',
              animation: `thinking 1.4s ${d}s ease-in-out infinite`,
            }}/>
          ))}
        </div>
      ) : message}
      {/* tail */}
      <div style={{
        position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
        width: 12, height: 12,
        background: 'oklch(1 0 0 / 0.85)',
        borderRight: '1px solid var(--hairline)',
        borderBottom: '1px solid var(--hairline)',
      }}/>
    </div>
  );
}

function StatusPill({ state }) {
  const meta = {
    idle:         { label: '대기 중',    color: 'var(--ink-3)',  dot: 'oklch(0.7 0.01 50)' },
    listening:    { label: '듣고 있어요', color: 'var(--glow)',   dot: 'var(--glow)' },
    transcribing: { label: '받아쓰는 중', color: 'var(--accent)', dot: 'var(--accent)' },
    thinking:     { label: '생각 중',    color: 'var(--accent)', dot: 'var(--accent)' },
    speaking:     { label: '말하는 중',   color: 'var(--accent)', dot: 'var(--accent-2)' },
  }[state];
  return (
    <div className="glass" style={{
      padding: '8px 14px 8px 10px',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      borderRadius: 999,
      fontSize: 13, fontWeight: 500, color: meta.color,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 99,
        background: meta.dot,
        boxShadow: `0 0 12px ${meta.dot}`,
        animation: state === 'idle' ? 'none' : 'auraBreath 1.6s ease-in-out infinite',
      }}/>
      {meta.label}
    </div>
  );
}

function Waveform({ active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 22 }}>
      {[0.0, 0.1, 0.25, 0.15, 0.32, 0.18, 0.08].map((d, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          height: 18,
          background: active ? 'var(--glow)' : 'var(--ink-4)',
          transformOrigin: 'center',
          animation: active ? `wave ${0.7 + (i % 3) * 0.15}s ${d}s ease-in-out infinite` : 'none',
          opacity: active ? 1 : 0.5,
        }}/>
      ))}
    </div>
  );
}

function ControlCluster({ state, setState, onOpenSettings, onOpenHistory, onOpenQuick, onSend, avatarHidden, onToggleAvatar }) {
  const [text, setText] = React.useState('');
  const [showInput, setShowInput] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (showInput) {
      // focus after transition
      const t = setTimeout(() => inputRef.current?.focus(), 180);
      return () => clearTimeout(t);
    }
  }, [showInput]);

  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    setShowInput(false);
  };

  const closeInput = () => {
    setShowInput(false);
    setText('');
  };

  const toggleVoice = () => {
    if (state === 'listening') setState('transcribing');
    else if (state === 'idle') setState('listening');
    else setState('idle');
  };

  return (
    <div style={{
      position: 'absolute', right: 24, bottom: 24,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12,
      zIndex: 30,
    }}>
      {/* status pill — sits above the input/cluster, aligned right */}
      <div style={{ paddingRight: 8, marginBottom: -4 }}>
        <StatusPill state={state}/>
      </div>

      {/* text input row — hidden by default; only surfaces on demand */}
      {showInput && (
        <div className="glass-strong" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: 6, paddingLeft: 18,
          borderRadius: 999,
          width: 440,
          animation: 'inputSlide 240ms var(--ease)',
        }}>
          <I.Keyboard size={16} style={{ color: 'var(--ink-3)' }}/>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') send();
              else if (e.key === 'Escape') closeInput();
            }}
            placeholder="메시지를 입력하세요"
            className="focus-ring"
            style={{
              flex: 1, padding: '10px 4px',
              background: 'transparent', border: 0, outline: 'none',
              fontSize: 14.5, letterSpacing: '-0.01em',
            }}
          />
          <button
            onClick={closeInput}
            title="닫기"
            style={{
              width: 28, height: 28, borderRadius: 999,
              background: 'transparent', color: 'var(--ink-3)',
              display: 'grid', placeItems: 'center',
              transition: 'all 160ms var(--ease)',
            }}
          >
            <I.Close size={14}/>
          </button>
          <button
            onClick={send}
            disabled={!text.trim()}
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: text.trim() ? 'var(--accent)' : 'oklch(0.88 0.01 60)',
              color: text.trim() ? 'white' : 'var(--ink-3)',
              display: 'grid', placeItems: 'center',
              transition: 'all 200ms var(--ease)',
            }}
          >
            <I.Send size={15}/>
          </button>
        </div>
      )}

      {/* button cluster */}
      <div className="glass-strong" style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: 6, borderRadius: 999,
      }}>
        <ClusterBtn onClick={onOpenQuick} title="자주 쓰는 기능"><I.Sparkles size={17}/></ClusterBtn>
        <ClusterBtn onClick={onOpenHistory} title="대화 기록"><I.History size={17}/></ClusterBtn>
        <ClusterBtn
          onClick={() => setShowInput(v => !v)}
          title={showInput ? '키보드 닫기' : '키보드로 입력'}
          active={showInput}
        ><I.Keyboard size={17}/></ClusterBtn>
        <ClusterBtn onClick={onToggleAvatar} title={avatarHidden ? '아바타 보이기' : '아바타 숨기기'} active={avatarHidden}>
          {avatarHidden ? <I.EyeOff size={17}/> : <I.Eye size={17}/>}
        </ClusterBtn>
        <Divider/>
        {/* voice button — primary */}
        <button
          onClick={toggleVoice}
          title="음성 입력 (Cmd+Shift+Space)"
          style={{
            width: 52, height: 52, borderRadius: 999,
            display: 'grid', placeItems: 'center',
            background: state === 'listening'
              ? 'linear-gradient(135deg, var(--glow) 0%, var(--accent) 100%)'
              : 'var(--accent)',
            color: 'white',
            boxShadow: state === 'listening'
              ? `0 0 0 6px oklch(0.82 0.13 320 / 0.18), 0 8px 24px oklch(0.82 0.13 320 / 0.45)`
              : `0 6px 18px oklch(0.74 0.14 45 / 0.4)`,
            transition: 'all 240ms var(--ease)',
            transform: state === 'listening' ? 'scale(1.05)' : 'scale(1)',
            position: 'relative',
          }}
        >
          {state === 'listening' ? <Waveform active/> : <I.Mic size={20}/>}
        </button>
        <Divider/>
        <ClusterBtn onClick={onOpenSettings} title="설정"><I.Settings size={17}/></ClusterBtn>
      </div>
    </div>
  );
}

function ClusterBtn({ children, onClick, title, active }) {
  const [hover, setHover] = React.useState(false);
  const bg = active
    ? 'var(--accent-soft)'
    : hover ? 'oklch(0.92 0.02 60 / 0.7)' : 'transparent';
  const color = active ? 'var(--accent-ink)' : (hover ? 'var(--ink)' : 'var(--ink-2)');
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: 40, height: 40, borderRadius: 999,
        display: 'grid', placeItems: 'center',
        color, background: bg,
        transition: 'all 160ms var(--ease)',
      }}
    >{children}</button>
  );
}
function Divider() {
  return <div style={{ width: 1, height: 24, background: 'var(--hairline-strong)', margin: '0 4px' }}/>;
}

function MainOverlay({ tweaks, isSettingsOpen, openSettings, isHistoryOpen, openHistory, openQuick }) {
  const [state, setState] = React.useState('idle');
  const [message, setMessage] = React.useState(null);
  const [avatarHidden, setAvatarHidden] = React.useState(false);

  // simulate flow
  React.useEffect(() => {
    let timers = [];
    if (state === 'transcribing') {
      timers.push(setTimeout(() => { setState('thinking'); setMessage('thinking'); }, 900));
    }
    if (state === 'thinking') {
      timers.push(setTimeout(() => {
        setState('speaking');
        setMessage('네, 오늘 일정 확인해드릴게요. 오전 10시에 디자인 리뷰, 오후 2시에 1:1 미팅이 있어요. 더 알려드릴까요?');
      }, 1400));
    }
    if (state === 'speaking') {
      timers.push(setTimeout(() => { setState('idle'); }, 4500));
      timers.push(setTimeout(() => { setMessage(null); }, 6000));
    }
    return () => timers.forEach(clearTimeout);
  }, [state]);

  const onSend = (txt) => {
    setMessage('thinking');
    setState('thinking');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div className="desktop-bg"/>

      {/* fake desktop label, top-left */}
      <div style={{
        position: 'absolute', top: 18, left: 24,
        fontSize: 11, color: 'var(--ink-4)', letterSpacing: 0.4, fontWeight: 500,
        textTransform: 'uppercase',
      }}>투명 오버레이 · macOS</div>



      {/* avatar centered in the lower-middle area */}
      {!avatarHidden && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'scaleIn 280ms var(--ease)',
        }}>
          <Avatar state={state} size={tweaks.avatarSize}/>
          <div style={{
            textAlign: 'center', marginTop: -8,
            fontSize: 13, color: 'var(--ink-3)', fontWeight: 500,
            letterSpacing: -0.01,
          }}>{tweaks.avatarName}</div>
        </div>
      )}

      {/* hidden state hint */}
      {avatarHidden && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center',
          padding: '10px 16px', borderRadius: 99,
          background: 'oklch(1 0 0 / 0.5)', boxShadow: 'inset 0 0 0 1px var(--hairline)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          animation: 'fade 220ms var(--ease)',
        }}>
          {tweaks.avatarName}는 잠깐 쉬는 중이에요
        </div>
      )}

      {/* speech bubble */}
      {message && (
        <SpeechBubble
          message={message === 'thinking' ? null : message}
          state={message === 'thinking' ? 'thinking' : 'speaking'}
        />
      )}

      {/* control cluster */}
      <ControlCluster
        state={state}
        setState={setState}
        onOpenSettings={openSettings}
        onOpenHistory={openHistory}
        onOpenQuick={openQuick}
        onSend={onSend}
        avatarHidden={avatarHidden}
        onToggleAvatar={() => setAvatarHidden(h => !h)}
      />
    </div>
  );
}

window.MainOverlay = MainOverlay;
window.SpeechBubble = SpeechBubble;
window.StatusPill = StatusPill;
