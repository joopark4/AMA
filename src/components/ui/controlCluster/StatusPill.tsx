/**
 * StatusPill — ControlCluster 좌측에 상시 표시되는 상태 배지.
 *
 * kind에 따라 점(dot)의 색상 + 브리드(breath) 애니메이션이 달라진다.
 * idle/listening/processing/speaking/error 5종 상태.
 */

export type StatusKind = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export function StatusPill({ kind, label }: { kind: StatusKind; label: string }) {
  const meta: Record<StatusKind, { dot: string; text: string; animate: boolean }> = {
    idle: { dot: 'oklch(0.7 0.01 50)', text: 'var(--ink-3)', animate: false },
    listening: { dot: 'var(--glow)', text: 'var(--glow)', animate: true },
    processing: { dot: 'var(--accent)', text: 'var(--accent)', animate: true },
    speaking: { dot: 'var(--ok)', text: 'var(--ok)', animate: true },
    error: { dot: 'var(--danger)', text: 'var(--danger)', animate: true },
  };
  const m = meta[kind];
  return (
    <div
      className="glass inline-flex items-center gap-2 px-3 py-1.5"
      style={{
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 500,
        color: m.text,
        letterSpacing: '-0.01em',
        // i18n 라벨 / transcript가 길어지면 cluster 행이 화면 밖으로 밀리는 것 방지.
        // pill 자체는 가변이지만 상한선 + 한 줄 ellipsis로 안정 폭 유지.
        maxWidth: 'min(260px, calc(100vw - 360px))',
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          background: m.dot,
          boxShadow: `0 0 12px ${m.dot}`,
          animation: m.animate ? 'auraBreath 1.6s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}
