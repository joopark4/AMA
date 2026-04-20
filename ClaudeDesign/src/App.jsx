// App shell — screen router + tweaks
const SCREENS = [
  { id: 'overlay',    label: '오버레이' },
  { id: 'settings',   label: '설정' },
  { id: 'history',    label: '대화 기록' },
  { id: 'quick',      label: '자주 쓰는 기능' },
  { id: 'onboarding', label: '온보딩' },
  { id: 'auth',       label: '로그인' },
  { id: 'premium',    label: '프리미엄' },
  { id: 'landing',    label: '랜딩' },
];

function App() {
  const [screen, setScreen] = React.useState(() => {
    return localStorage.getItem('ama:screen') || 'overlay';
  });
  const [tweaksOn, setTweaksOn] = React.useState(false);

  // tweakable defaults
  const [tweaks, setTweaks] = React.useState(/*EDITMODE-BEGIN*/{
    "avatarName": "은연",
    "avatarSize": 240,
    "accent": 45
  }/*EDITMODE-END*/);

  // enabled quick features (persisted separately — not a visual tweak)
  const [enabledQuicks, setEnabledQuicks] = React.useState(() => {
    try {
      const saved = localStorage.getItem('ama:quicks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['calendar', 'mail', 'translate', 'capture'];
  });
  React.useEffect(() => {
    localStorage.setItem('ama:quicks', JSON.stringify(enabledQuicks));
  }, [enabledQuicks]);

  const [overlay, setOverlay] = React.useState(null); // 'settings' | 'history' | 'quick' | 'premium'

  React.useEffect(() => {
    localStorage.setItem('ama:screen', screen);
    setOverlay(null);
  }, [screen]);

  // accent live update
  React.useEffect(() => {
    document.documentElement.style.setProperty('--accent', `oklch(0.74 0.14 ${tweaks.accent})`);
    document.documentElement.style.setProperty('--accent-2', `oklch(0.82 0.11 ${tweaks.accent})`);
    document.documentElement.style.setProperty('--accent-soft', `oklch(0.93 0.05 ${tweaks.accent})`);
    document.documentElement.style.setProperty('--accent-ink', `oklch(0.32 0.10 ${tweaks.accent})`);
  }, [tweaks.accent]);

  // tweaks protocol
  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode')   setTweaksOn(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOn(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  React.useEffect(() => {
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits: tweaks,
    }, '*');
  }, [tweaks]);

  return (
    <div data-screen-label={SCREENS.find(s => s.id === screen)?.label || screen}
         style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* prototype chrome — segmented control */}
      <div className="proto-chrome">
        {SCREENS.map(s => (
          <button key={s.id}
            className={screen === s.id ? 'active' : ''}
            onClick={() => setScreen(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* base screen */}
      {screen === 'overlay' && (
        <MainOverlay
          tweaks={tweaks}
          isSettingsOpen={overlay === 'settings'}
          openSettings={() => setOverlay('settings')}
          isHistoryOpen={overlay === 'history'}
          openHistory={() => setOverlay('history')}
          openQuick={() => setOverlay('quick')}
        />
      )}
      {screen === 'settings' && (
        <>
          <MainOverlay tweaks={tweaks}
            openSettings={() => {}} openHistory={() => {}} openQuick={() => {}}/>
          <SettingsPanel onClose={() => setScreen('overlay')} tweaks={tweaks} setTweaks={setTweaks}
            enabledQuicks={enabledQuicks} setEnabledQuicks={setEnabledQuicks}/>
        </>
      )}
      {screen === 'history' && (
        <>
          <MainOverlay tweaks={tweaks}
            openSettings={() => {}} openHistory={() => {}} openQuick={() => {}}/>
          <HistoryPanel onClose={() => setScreen('overlay')}/>
        </>
      )}
      {screen === 'quick' && (
        <>
          <MainOverlay tweaks={tweaks}
            openSettings={() => {}} openHistory={() => {}} openQuick={() => {}}/>
          <QuickActions onClose={() => setScreen('overlay')} enabledQuicks={enabledQuicks}
            onOpenSettings={() => { setScreen('settings'); }}/>
        </>
      )}
      {screen === 'onboarding' && <Onboarding onDone={() => setScreen('overlay')}/>}
      {screen === 'auth'       && <AuthScreen onDone={() => setScreen('onboarding')}/>}
      {screen === 'premium'    && (
        <>
          <MainOverlay tweaks={tweaks}
            openSettings={() => {}} openHistory={() => {}} openQuick={() => {}}/>
          <Premium onClose={() => setScreen('overlay')}/>
        </>
      )}
      {screen === 'landing'    && <Landing/>}

      {/* in-overlay popups */}
      {screen === 'overlay' && overlay === 'settings' && (
        <SettingsPanel onClose={() => setOverlay(null)} tweaks={tweaks} setTweaks={setTweaks}
          enabledQuicks={enabledQuicks} setEnabledQuicks={setEnabledQuicks}/>
      )}
      {screen === 'overlay' && overlay === 'history' && (
        <HistoryPanel onClose={() => setOverlay(null)}/>
      )}
      {screen === 'overlay' && overlay === 'quick' && (
        <QuickActions onClose={() => setOverlay(null)} enabledQuicks={enabledQuicks}
          onOpenSettings={() => { setOverlay('settings'); }}/>
      )}

      {tweaksOn && <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} onClose={() => setTweaksOn(false)}/>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
