/**
 * ListeningBars — Voice 버튼 내 7개 막대.
 *
 * audioProcessor에서 실시간 amplitude를 읽어 각 막대의 scaleY를 동기화.
 * 마운트는 voice button이 listening일 때만 (외부에서 조건부 렌더).
 */
import { useEffect, useRef } from 'react';
import { audioProcessor } from '../../../services/voice/audioProcessor';

export function ListeningBars() {
  const containerRef = useRef<HTMLDivElement>(null);
  const BAR_COUNT = 7;
  const SAMPLES_PER_BAR = 4;
  const SMOOTH = 0.4;
  const FRAME_INTERVAL_MS = 1000 / 30;
  const SENSITIVITY = 3.5;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const bars = Array.from(container.children) as HTMLElement[];
    let rafId: number | null = null;
    let lastFrame = 0;
    const smoothed = new Float32Array(BAR_COUNT);

    const tick = (ts: number) => {
      rafId = requestAnimationFrame(tick);
      if (ts - lastFrame < FRAME_INTERVAL_MS) return;
      lastFrame = ts;

      const data = audioProcessor.getWaveformData(BAR_COUNT * SAMPLES_PER_BAR);
      for (let i = 0; i < BAR_COUNT; i++) {
        let peak = 0;
        for (let j = 0; j < SAMPLES_PER_BAR; j++) {
          const v = Math.abs(data[i * SAMPLES_PER_BAR + j] || 0);
          if (v > peak) peak = v;
        }
        smoothed[i] = smoothed[i] * (1 - SMOOTH) + peak * SMOOTH;
        const scaled = Math.max(0.2, Math.min(1, smoothed[i] * SENSITIVITY));
        bars[i].style.transform = `scaleY(${scaled})`;
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      // 언마운트 직후 DOM이 제거되므로 transform 리셋은 불필요 (dead code 제거).
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center gap-[3px]"
      style={{ height: 22 }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: 18,
            borderRadius: 2,
            background: 'white',
            transformOrigin: 'center',
            transform: 'scaleY(0.4)',
            transition: 'transform 60ms linear',
          }}
        />
      ))}
    </div>
  );
}
