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
  /** pill 외곽 폭(px). 미지정 시 320. ControlCluster에서 메뉴바 폭과 동기화. */
  width?: number;
}

const SAMPLE_COUNT = 96;
const FRAME_INTERVAL_MS = 1000 / 30;
const EMA_ALPHA = 0.38;

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

  // waveform (accent 톤) — 진폭은 midY 기준 위/아래 ±(midY × 0.85)로 클램프해
  // canvas 경계를 벗어나지 않도록 안전 한도 적용 (큰 음성에서도 잘리지 않음).
  ctx.strokeStyle = 'rgba(230, 144, 58, 0.95)';
  ctx.lineWidth = Math.max(1.5, width / 220);
  ctx.beginPath();

  const safeAmplitude = midY * 0.85;
  for (let i = 0; i < waveform.length; i++) {
    const x = (i / (waveform.length - 1)) * width;
    const y = midY + waveform[i] * safeAmplitude;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

export default function VoiceWaveform({ label, width = 320 }: VoiceWaveformProps) {
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
        smoothed[i] = smoothed[i] * (1 - EMA_ALPHA) + raw[i] * EMA_ALPHA;
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
        width,
      }}
      data-interactive="false"
    >
      <div
        className="flex items-center"
        style={{
          gap: 8,
          padding: '2px 12px',
          borderRadius: 999,
          background: 'var(--surface-2)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          boxShadow: 'inset 0 1px 0 var(--top-edge), inset 0 0 0 1px var(--hairline)',
          // canvas 가장자리가 둥근 pill 경계를 살짝 벗어나는 시각적 잔상 방지
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            fontSize: 11,
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
          style={{ height: 18 }}
        />
      </div>
    </div>
  );
}
