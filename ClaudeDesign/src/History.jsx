// History panel — draggable chat log
function HistoryPanel({ onClose }) {
  const [filter, setFilter] = React.useState('all');
  const items = [
    { who: 'me',  text: '오늘 일정 알려줘', time: '오후 2:14' },
    { who: 'ai',  text: '오늘 일정은 오전 10시 디자인 리뷰, 오후 2시 1:1 미팅이 있어요.', time: '오후 2:14' },
    { who: 'me',  text: '디자인 리뷰 메모 정리해줘', time: '오후 2:15' },
    { who: 'ai',  text: '리뷰에서 나온 핵심은 세 가지예요: 1) 컨트롤 클러스터 위계 정리, 2) 말풍선 hover 상태 추가, 3) 다크 모드 컬러 토큰 검증.', time: '오후 2:16' },
    { who: 'me',  text: '내일 아침 9시에 회의 일정 잡아줘', time: '오후 4:02' },
    { who: 'ai',  text: '캘린더에 \"디자인 시스템 미팅\" 으로 등록했어요. 알림은 10분 전으로 설정했습니다.', time: '오후 4:02' },
  ];

  return (
    <div className="glass-strong" style={{
      position: 'absolute', left: 24, top: 70, bottom: 24,
      width: 380, zIndex: 35, padding: 0, overflow: 'hidden',
      animation: 'scaleIn 260ms var(--ease)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'grab',
      }}>
        <I.History size={16} style={{ color: 'var(--ink-2)' }}/>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>대화 기록</div>
        <button onClick={onClose} className="focus-ring" style={{
          width: 28, height: 28, borderRadius: 99, display: 'grid', placeItems: 'center',
          color: 'var(--ink-2)', background: 'oklch(1 0 0 / 0.55)',
          boxShadow: 'inset 0 0 0 1px var(--hairline)',
        }}><I.Close size={14}/></button>
      </div>

      <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6 }}>
        {[
          { v: 'all', l: '전체' },
          { v: 'today', l: '오늘' },
          { v: 'fav', l: '즐겨찾기' },
        ].map(t => (
          <Pill key={t.v} active={filter === t.v} onClick={() => setFilter(t.v)}>{t.l}</Pill>
        ))}
      </div>

      <div className="scroll" style={{
        flex: 1, overflowY: 'auto', padding: '4px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{
          fontSize: 11, color: 'var(--ink-3)', fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8, marginBottom: 2,
        }}>오늘 · 4월 20일</div>

        {items.map((m, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: m.who === 'me' ? 'row-reverse' : 'row',
            gap: 8, alignItems: 'flex-end',
          }}>
            <div style={{
              maxWidth: '78%',
              padding: '9px 13px', borderRadius: 16,
              background: m.who === 'me' ? 'var(--accent)' : 'oklch(1 0 0 / 0.78)',
              color: m.who === 'me' ? 'white' : 'var(--ink)',
              fontSize: 13.5, lineHeight: 1.5,
              boxShadow: m.who === 'me' ? 'none' : 'inset 0 0 0 1px var(--hairline)',
              borderBottomRightRadius: m.who === 'me' ? 6 : 16,
              borderBottomLeftRadius: m.who === 'ai' ? 6 : 16,
            }}>{m.text}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', whiteSpace: 'nowrap', paddingBottom: 2 }}>
              {m.time}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--hairline)',
        background: 'oklch(1 0 0 / 0.4)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>총 142개의 대화</span>
        <button style={{
          fontSize: 12, color: 'var(--danger)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}><I.Trash size={12}/> 모두 삭제</button>
      </div>
    </div>
  );
}

window.HistoryPanel = HistoryPanel;
