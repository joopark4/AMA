/**
 * Screen Watch Service — 주기적 화면 관찰 + Vision LLM 분석
 *
 * - Rust `capture_screen_for_watch`로 캡처 (변화 감지 + JPEG 리사이즈)
 * - Provider 분기:
 *   - API (Claude/OpenAI/Gemini): Base64 inline 전송 (chatWithVision)
 *   - CLI (Codex/Claude Code): 파일 저장 후 경로를 텍스트에 포함
 * - LLM 응답 수신 후 저장된 이미지 파일 즉시 삭제 (finally)
 * - 링버퍼로 최근 3개 관찰 결과 유지 → 중복 발언 방지
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  CaptureTarget,
  ScreenWatchResponseStyle,
  ScreenWatchSettings,
} from '../../stores/settingsStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { ClaudeClient } from '../../services/ai/claudeClient';
import { OpenAIClient } from '../../services/ai/openaiClient';
import { GeminiClient } from '../../services/ai/geminiClient';
import { llmRouter } from '../../services/ai/llmRouter';
import type { Message as LLMMessage } from '../../services/ai/types';
import { buildSystemPrompt } from '../../hooks/useConversation';

type RustCaptureResult =
  | { status: 'unchanged' }
  | { status: 'changed'; data: string; path: string | null; width: number; height: number }
  | { status: 'permission_denied' }
  | { status: 'error'; message: string };

export type ObserveOutcome =
  | { kind: 'spoke'; text: string }
  | { kind: 'skip'; reason: 'no_change' | 'llm_skip' | 'empty' | 'silent_hours' }
  | { kind: 'error'; reason: 'permission' | 'llm' | 'capture'; detail?: string };

const RECENT_OBSERVATIONS_LIMIT = 3;

const VISION_SUPPORTED_PROVIDERS = new Set([
  'claude',
  'openai',
  'gemini',
  'codex',
  'claude_code',
]);

export function isVisionAvailable(provider: string): boolean {
  return VISION_SUPPORTED_PROVIDERS.has(provider);
}

/** 자정 넘기는 경우 처리 포함. */
export function isInSilentHours(
  now: Date,
  silent: ScreenWatchSettings['silentHours']
): boolean {
  if (!silent.enabled) return false;
  const hour = now.getHours();
  const { start, end } = silent;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  // 자정 넘기기 (예: 23 ~ 7)
  return hour >= start || hour < end;
}

function getStyleHint(style: ScreenWatchResponseStyle): string {
  switch (style) {
    case 'advisor':
      return '당신은 따뜻한 조언가입니다. 사용자의 작업에 도움이 될 만한 힌트나 격려를 짧게 건네세요.';
    case 'comedian':
      return '당신은 유머러스한 동반자입니다. 화면을 보고 재치있는 농담이나 가벼운 놀림을 던지세요.';
    case 'analyst':
      return '당신은 분석가입니다. 화면을 보고 사용자가 놓치기 쉬운 관찰이나 데이터 포인트를 짚어주세요.';
    case 'balanced':
    default:
      return '당신은 균형잡힌 동반자입니다. 화면을 보고 상황에 맞는 한 마디(격려/조언/가벼운 농담 중 하나)를 건네세요.';
  }
}

export class ScreenWatchService {
  private recentObservations: string[] = [];

  /** 앱 시작 시 잔여 스크린샷 파일 정리 */
  async cleanupResiduals(): Promise<void> {
    try {
      await invoke('cleanup_screen_watch_residuals');
    } catch {
      // 무시
    }
  }

  /** 비활성화 시 Rust 측 비교 버퍼 해제 */
  async clearState(): Promise<void> {
    try {
      await invoke('clear_screen_watch_state');
      this.recentObservations = [];
    } catch {
      // 무시
    }
  }

  async listWindows(): Promise<{ appName: string; windowTitle: string; windowId: number }[]> {
    try {
      return await invoke('list_windows');
    } catch {
      return [];
    }
  }

  /**
   * 한 번의 관찰 수행.
   */
  async observeScreen(options: {
    captureTarget: CaptureTarget;
    responseStyle: ScreenWatchResponseStyle;
  }): Promise<ObserveOutcome> {
    const { settings } = useSettingsStore.getState();
    const provider = settings.llm.provider;

    if (!isVisionAvailable(provider)) {
      return { kind: 'error', reason: 'llm', detail: 'vision not supported' };
    }

    // CLI provider는 파일 경로 전달 → save_dir 지정
    const needsFile = provider === 'codex' || provider === 'claude_code';
    const saveDir = needsFile ? await this.resolveSaveDir(provider) : null;
    const saveFilename = needsFile ? '.screen_watch.jpg' : undefined;

    // 캡처
    let capture: RustCaptureResult;
    try {
      capture = await invoke<RustCaptureResult>('capture_screen_for_watch', {
        target: options.captureTarget,
        saveDir,
        saveFilename,
      });
    } catch (err) {
      return { kind: 'error', reason: 'capture', detail: String(err) };
    }

    if (capture.status === 'unchanged') {
      return { kind: 'skip', reason: 'no_change' };
    }
    if (capture.status === 'permission_denied') {
      return { kind: 'error', reason: 'permission' };
    }
    if (capture.status === 'error') {
      return { kind: 'error', reason: 'capture', detail: capture.message };
    }

    // LLM 호출
    const savedPath = capture.path;
    try {
      const systemPrompt = this.buildObservationPrompt(options.responseStyle);
      const userPrompt = '방금 캡처된 사용자 화면이다. 위 규칙에 따라 짧게 한마디 해라.';

      let responseText: string;
      if (provider === 'claude' || provider === 'openai' || provider === 'gemini') {
        responseText = await this.callVisionAPI(provider, systemPrompt, userPrompt, capture.data);
      } else {
        // CLI: 경로 텍스트 포함
        if (!savedPath) {
          return { kind: 'error', reason: 'capture', detail: 'file path missing' };
        }
        responseText = await this.callCLIWithPath(systemPrompt, userPrompt, savedPath);
      }

      const trimmed = (responseText ?? '').trim();
      if (!trimmed || /^\[?SKIP\]?/i.test(trimmed)) {
        return { kind: 'skip', reason: 'llm_skip' };
      }

      this.pushRecent(trimmed);
      return { kind: 'spoke', text: trimmed };
    } catch (err) {
      return { kind: 'error', reason: 'llm', detail: String(err) };
    } finally {
      // 저장된 파일 삭제 (finally 보장)
      if (savedPath) {
        invoke('delete_screen_watch_image', { path: savedPath }).catch(() => {});
      }
    }
  }

  private pushRecent(text: string): void {
    this.recentObservations.push(text);
    if (this.recentObservations.length > RECENT_OBSERVATIONS_LIMIT) {
      this.recentObservations.shift();
    }
  }

  private buildObservationPrompt(style: ScreenWatchResponseStyle): string {
    const { settings } = useSettingsStore.getState();
    const base = buildSystemPrompt(settings.avatarName || '', settings.avatarPersonalityPrompt || '');
    const recent =
      this.recentObservations.length > 0
        ? `\n[최근 관찰 발언 — 중복/반복 금지]\n${this.recentObservations.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
        : '';

    return [
      base,
      getStyleHint(style),
      '[규칙]',
      '- 1~2문장, 반말, 이모지 없음.',
      '- 말할 가치가 없으면 단일 토큰 "[SKIP]"만 출력하고 다른 문자는 쓰지 마라.',
      '- 비밀번호/카드번호/주민번호/개인 이메일 등 민감정보는 절대 언급 금지.',
      '- 단순 화면 나열 금지. 상황에 대한 "반응"을 하라.',
      '- 같은 대상에 대한 반복 발언 금지 (최근 발언 참조).',
      recent,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async callVisionAPI(
    provider: 'claude' | 'openai' | 'gemini',
    systemPrompt: string,
    userPrompt: string,
    imageBase64: string
  ): Promise<string> {
    const messages = [{ role: 'user' as const, content: userPrompt }];
    const mimeType = 'image/jpeg';

    if (provider === 'claude') {
      const client = new ClaudeClient();
      const res = await client.chatWithVision(messages, imageBase64, { systemPrompt, mimeType });
      return res.content;
    }
    if (provider === 'openai') {
      const client = new OpenAIClient();
      const res = await client.chatWithVision(messages, imageBase64, { systemPrompt, mimeType });
      return res.content;
    }
    const client = new GeminiClient();
    const res = await client.chatWithVision(messages, imageBase64, { systemPrompt, mimeType });
    return res.content;
  }

  private async callCLIWithPath(
    systemPrompt: string,
    userPrompt: string,
    imagePath: string
  ): Promise<string> {
    const textWithPath = `${userPrompt}\n[이미지 파일 경로]: ${imagePath}\n위 파일을 읽어 분석하라.`;
    const llmMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: textWithPath },
    ];
    const res = await llmRouter.chat(llmMessages, { temperature: 0.7, maxTokens: 200 });
    return res.content;
  }

  private async resolveSaveDir(provider: string): Promise<string | null> {
    const { settings } = useSettingsStore.getState();
    if (provider === 'codex') {
      const dir = settings.codex?.workingDir?.trim();
      if (dir) return dir;
      // fallback: ~/.mypartnerai/screenshots
      return this.getDefaultSaveDir();
    }
    if (provider === 'claude_code') {
      // ama-bridge에 GET /project-dir 조회 (추후 구현)
      try {
        const resp = await fetch('http://127.0.0.1:3123/project-dir');
        if (resp.ok) {
          const body = (await resp.json()) as { path?: string };
          if (body.path) return body.path;
        }
      } catch {
        // 무시
      }
      return this.getDefaultSaveDir();
    }
    return this.getDefaultSaveDir();
  }

  private getDefaultSaveDir(): string {
    // Node/Rust에서 home 확장. 프론트는 환경변수 없이 알 수 없으므로
    // Rust 측 capture_screen_for_watch가 빈 save_dir를 받으면 자체 기본 경로 사용하도록
    // 되어 있지 않으므로, 여기선 빈 문자열 반환해 save_dir 없이 호출되게 한다.
    return '';
  }
}

export const screenWatchService = new ScreenWatchService();
