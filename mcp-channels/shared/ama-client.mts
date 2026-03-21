/**
 * 공유 AMA HTTP 클라이언트
 *
 * MCP 채널 서버들이 AMA 앱의 /speak 엔드포인트에
 * 텍스트를 보내 아바타 TTS를 트리거한다.
 */

import { readFile } from 'node:fs/promises';
import { PORTS, AMA_TOKEN_PATH, MAX_TEXT_LENGTH } from './config.mts';

let cachedToken: string | null = null;

async function loadToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = (await readFile(AMA_TOKEN_PATH, 'utf-8')).trim();
    return cachedToken;
  } catch {
    throw new Error(
      `AMA 토큰 파일을 읽을 수 없습니다: ${AMA_TOKEN_PATH}\nAMA 앱이 실행 중인지 확인하세요.`
    );
  }
}

export interface SpeakOptions {
  priority?: 'normal' | 'urgent';
  emotion?: string;
  voice?: string;
}

export interface SpeakResult {
  accepted: boolean;
  queue_position?: number;
  error?: string;
}

const BASE_URL = `http://127.0.0.1:${PORTS.AMA_SPEAK}`;

/**
 * AMA 아바타에 텍스트를 보내 TTS + 말풍선 + 감정 모션을 트리거한다.
 * AMA가 미실행이면 조용히 실패한다.
 */
export async function speak(
  text: string,
  source: string,
  options: SpeakOptions = {}
): Promise<SpeakResult | null> {
  try {
    const token = await loadToken();
    const body = JSON.stringify({
      text: text.slice(0, MAX_TEXT_LENGTH),
      source,
      priority: options.priority ?? 'normal',
      emotion: options.emotion,
      voice: options.voice,
    });

    const res = await fetch(`${BASE_URL}/speak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[ama-client] /speak ${res.status}: ${errText}`);
      return { accepted: false, error: `HTTP ${res.status}` };
    }

    return (await res.json()) as SpeakResult;
  } catch (err) {
    // AMA 미실행 시 조용히 로깅
    console.error(`[ama-client] speak 실패 (AMA 미실행?):`, (err as Error).message);
    return null;
  }
}

/**
 * AMA 앱 가동 상태를 확인한다.
 */
export async function health(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 토큰 캐시를 무효화한다 (토큰 갱신 시).
 */
export function invalidateToken(): void {
  cachedToken = null;
}
