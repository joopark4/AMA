/**
 * VoiceWaveform — 음성 입력 중 표시되는 audio level 바 (v2 리디자인).
 *
 * 단일 라인 글래시 pill 형태 (label + 가로로 길게 늘어선 canvas).
 * 클러스터 바와 비슷한 폭(~320px), 텍스트 입력 pill과 비슷한 높이(~22px).
 */
import { useEffect, useRef } from 'react';
import { audioProcessor } from '../../services/voice/audioProcessor';

interface VoiceWaveformProps {
  label: string;
}

const SAMPLE_COUNT = 96;
const FRAME_INTERVAL_MS = 1000 / 30;
// EMA 반응 속도: 값이 클수록 즉각적 (0~1)
const EMA_ALPHA = 0.55;
// raw amplitude 증폭 배수 — 일반 음성은 보통 ±0.1~0.25라
// 5배 증폭한 뒤 ±1로 클램프하면 시각적으로 흔들림이 잘 보임.
const AMPLIFY = 5.0;

function ensureCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const width = Math.max(1, Math.floor(cssWidth * ratio));
  const height = Math.max(1, Math.floor(cssHeight * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return { width, height };
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  waveform: Float32Array
): void {
  ctx.clearRect(0, 0, width, height);
  if (waveform.length === 0) return;

  const midY = height / 2;

  // baseline (글래시 위에서 보이는 어두운 hairline)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = Math.max(1, Math.floor(width / 320));
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  // waveform (accent 톤) — 라인 두께 ↑, 진폭 한도 ↑로 흔들림 시각 강조.
  ctx.strokeStyle = 'rgba(230, 144, 58, 0.95)';
  ctx.lineWidth = Math.max(2, width / 180);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  const amplitude = height * 0.46; // midY 기준 위/아래 최대치 (height의 92%까지 사용)

  for (let i = 0; i < waveform.length; i++) {
    const x = (i / (waveform.length - 1)) * width;
    const y = midY + waveform[i] * amplitude;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

export default function VoiceWaveform({ label }: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number | null = null;
    let lastFrameAt = 0;
    const smoothed = new Float32Array(SAMPLE_COUNT);

    const frame = (timestamp: number) => {
      rafId = requestAnimationFrame(frame);
      if (timestamp - lastFrameAt < FRAME_INTERVAL_MS) return;
      lastFrameAt = timestamp;

      const raw = audioProcessor.getWaveformData(SAMPLE_COUNT);
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        // amplify + clamp [-1, 1] → 작은 음성도 잘 보이게.
        const amplified = Math.max(-1, Math.min(1, raw[i] * AMPLIFY));
        smoothed[i] = smoothed[i] * (1 - EMA_ALPHA) + amplified * EMA_ALPHA;
      }

      const { width, height } = ensureCanvasSize(canvas);
      drawWaveform(ctx, width, height, smoothed);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, []);

  return (
    <div
      className="pointer-events-none"
      style={{
        width: 420,
      }}
      data-interactive="false"
    >
      <div
        className="flex items-center"
        style={{
          gap: 10,
          padding: '8px 16px',
          borderRadius: 999,
          background: 'var(--surface-2)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          boxShadow: 'inset 0 1px 0 var(--top-edge), inset 0 0 0 1px var(--hairline)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: 'var(--ink-2)',
            whiteSpace: 'nowrap',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </span>
        <canvas
          ref={canvasRef}
          className="block flex-1"
          style={{ height: 36 }}
        />
      </div>
    </div>
  );
}
