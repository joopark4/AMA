/**
 * 문장 단위 TTS 큐 시스템
 *
 * Phase 1: 스트리밍 응답에서 문장 단위로 TTS를 파이프라이닝한다.
 * - 문장 종결 감지 → 큐에 push
 * - 순차 재생 (재생 중 다음 문장 미리 합성)
 * - 인터럽트 시 큐 전체 flush + 현재 재생 중단
 */

import { ttsRouter } from './ttsRouter';
import type { TTSOptions } from './types';

// 한국어/일본어/영어 문장 종결 패턴
const SENTENCE_END_REGEX = /[.!?~。！？]\s*$|[요다야지니까네죠래라][\s!?~]*$|[\n]/;

interface QueueItem {
  text: string;
  options?: TTSOptions;
}

type QueueState = 'idle' | 'playing' | 'flushed';

export class TTSQueue {
  private queue: QueueItem[] = [];
  private state: QueueState = 'idle';
  private buffer = '';
  private onLipSyncStart?: () => void;
  private onLipSyncStop?: () => void;
  private playPromise: Promise<void> | null = null;
  private ttsOptions?: TTSOptions;

  /**
   * 큐 초기화 — 스트리밍 시작 시 호출
   */
  start(options?: {
    ttsOptions?: TTSOptions;
    onLipSyncStart?: () => void;
    onLipSyncStop?: () => void;
  }): void {
    this.flush();
    this.state = 'idle';
    this.buffer = '';
    this.ttsOptions = options?.ttsOptions;
    this.onLipSyncStart = options?.onLipSyncStart;
    this.onLipSyncStop = options?.onLipSyncStop;
  }

  /**
   * 토큰 추가 — onToken 콜백에서 호출
   * 문장 종결 감지 시 큐에 자동 push
   */
  pushToken(token: string): void {
    if (this.state === 'flushed') return;
    this.buffer += token;

    if (SENTENCE_END_REGEX.test(this.buffer.trim())) {
      const sentence = this.buffer.trim();
      this.buffer = '';
      if (sentence) {
        this.enqueue(sentence);
      }
    }
  }

  /**
   * 스트리밍 완료 — 잔여 버퍼 flush + 재생 완료 대기
   */
  async complete(): Promise<void> {
    if (this.state === 'flushed') return;

    // 잔여 버퍼 push
    const remaining = this.buffer.trim();
    this.buffer = '';
    if (remaining) {
      this.enqueue(remaining);
    }

    // 현재 재생 + 큐 잔여분 완료 대기
    await this.waitUntilDrained();
  }

  /**
   * 인터럽트 — 큐 전체 flush + 현재 재생 중단
   */
  flush(): void {
    this.state = 'flushed';
    this.queue = [];
    this.buffer = '';
    ttsRouter.stopPlayback();
    this.onLipSyncStop?.();
  }

  private enqueue(text: string): void {
    this.queue.push({ text, options: this.ttsOptions });
    this.processNext();
  }

  private processNext(): void {
    if (this.state === 'flushed') return;
    if (this.state === 'playing') return; // 이미 재생 중이면 complete에서 순차 처리
    if (this.queue.length === 0) return;

    this.state = 'playing';
    const item = this.queue.shift()!;

    this.playPromise = this.playItem(item).finally(() => {
      if (this.state === 'flushed') return;
      this.state = 'idle';
      // 다음 아이템이 있으면 바로 재생
      if (this.queue.length > 0) {
        this.processNext();
      }
    });
  }

  private async playItem(item: QueueItem): Promise<void> {
    try {
      this.onLipSyncStart?.();
      await ttsRouter.playAudio(item.text, item.options);
    } catch (err) {
      console.error('[TTSQueue] playItem error:', err);
    } finally {
      this.onLipSyncStop?.();
    }
  }

  private async waitUntilDrained(): Promise<void> {
    // 현재 재생 대기
    while (this.state === 'playing' || this.queue.length > 0) {
      if (this.playPromise) {
        await this.playPromise;
      }
      // 큐에 아이템이 남아 있으면 processNext가 다시 시작
      if (this.queue.length > 0 && this.state === 'idle') {
        this.processNext();
      }
      // idle이고 큐도 비었으면 종료
      if (this.state === 'idle' && this.queue.length === 0) break;
      // flushed면 즉시 종료
      if (this.state === 'flushed') break;
      // 짧은 대기 후 재확인
      await new Promise(r => setTimeout(r, 50));
    }
  }
}

/** 싱글톤 인스턴스 */
export const ttsQueue = new TTSQueue();
