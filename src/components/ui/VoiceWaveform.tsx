import { useEffect, useRef } from 'react';
import { audioProcessor } from '../../services/voice/audioProcessor';

interface VoiceWaveformProps {
  label: string;
}

const SAMPLE_COUNT = 64;
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

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = Math.max(1, Math.floor(width / 280));
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = Math.max(1.5, width / 180);
  ctx.beginPath();

  for (let i = 0; i < waveform.length; i++) {
    const x = (i / (waveform.length - 1)) * width;
    const y = midY + waveform[i] * (height * 0.8);
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
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 pointer-events-none"
      data-interactive="false"
    >
      <div className="px-2 py-1 text-[11px] text-white text-center rounded-t-md bg-slate-900/85 border border-slate-600 border-b-0">
        {label}
      </div>
      <div className="px-2 py-1 rounded-b-md bg-slate-900/85 border border-slate-600 border-t-0">
        <canvas ref={canvasRef} className="block w-full h-12" />
      </div>
    </div>
  );
}
