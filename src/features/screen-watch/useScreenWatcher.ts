import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../stores/settingsStore';
import { useConversationStore } from '../../stores/conversationStore';
import { processExternalResponse } from '../channels';
import { screenWatchService, isInSilentHours, isVisionAvailable } from './screenWatchService';

/**
 * useScreenWatcher — Screen Watch 타이머 루프
 *
 * - 10초마다 tick → `Date.now() - lastObservationTime >= intervalSeconds * 1000`이면 관찰 실행
 *   (setInterval 밀림 대응 — sleep/wake 후 연속 실행 방지)
 * - `isObservingRef` 플래그로 동시 관찰 방지
 * - 대화 진행(isProcessing/isSpeaking) 중엔 스킵
 * - 설정 OFF → Rust 측 비교 버퍼 해제
 * - 앱 시작/토글 ON 후 INITIAL_DELAY_MS 후 첫 tick (리소스 경합 회피)
 */

const TICK_INTERVAL_MS = 10_000;
// 초기 지연 — 앱 부팅 직후 캡처/LLM 호출 폭주 방지. 설정 토글 ON 직후에도 동일 적용.
const INITIAL_DELAY_MS = 5_000;
const debug = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log('[screen-watch]', ...args);
    // Rust terminal에도 찍혀서 Tauri stdout으로 추적 가능
    const msg = args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
    invoke('log_to_terminal', { message: `[screen-watch] ${msg}` }).catch(() => {});
  }
};

export function useScreenWatcher(): void {
  const enabled = useSettingsStore((s) => s.settings.screenWatch?.enabled ?? false);
  const provider = useSettingsStore((s) => s.settings.llm.provider);

  const isObservingRef = useRef(false);
  const lastObservationAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 앱 시작 시 한 번 잔여 스크린샷 정리
    void screenWatchService.cleanupResiduals();
  }, []);

  useEffect(() => {
    // Provider가 Vision 미지원이거나 토글 OFF면 비활성
    if (!enabled || !isVisionAvailable(provider)) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (initialTimerRef.current) {
        clearTimeout(initialTimerRef.current);
        initialTimerRef.current = null;
      }
      isObservingRef.current = false;
      lastObservationAtRef.current = 0;
      void screenWatchService.clearState();
      return;
    }

    debug('enabled for provider:', provider);

    const tick = async () => {
      if (isObservingRef.current) {
        debug('skip: already observing');
        return;
      }
      const state = useConversationStore.getState();
      if (state.isProcessing || state.isSpeaking || state.isListening) {
        debug('skip: conversation active', { status: state.status });
        return;
      }
      const settingsNow = useSettingsStore.getState().settings.screenWatch;
      if (!settingsNow.enabled) return;

      // 조용한 시간
      if (isInSilentHours(new Date(), settingsNow.silentHours)) {
        debug('skip: silent hours');
        return;
      }

      // 시간 기반 쿨다운 (setInterval 밀림 대응)
      const now = Date.now();
      const intervalMs = settingsNow.intervalSeconds * 1000;
      if (lastObservationAtRef.current > 0 && now - lastObservationAtRef.current < intervalMs) {
        return;
      }

      isObservingRef.current = true;
      lastObservationAtRef.current = now;
      try {
        const outcome = await screenWatchService.observeScreen({
          captureTarget: settingsNow.captureTarget,
          responseStyle: settingsNow.responseStyle,
        });
        debug('outcome:', outcome);

        if (outcome.kind !== 'spoke') return;

        // 발화 직전 전체 가드 재검사 — LLM 대기 중 상태가 바뀔 수 있음:
        //  - 사용자가 대화 시작 / 비활성화 토글 / provider 전환 / 조용한 시간 진입
        const stateAfter = useConversationStore.getState();
        if (stateAfter.isProcessing || stateAfter.isSpeaking || stateAfter.isListening) {
          debug('skip after LLM: user conversation started');
          return;
        }
        const settingsAfter = useSettingsStore.getState().settings;
        const watchAfter = settingsAfter.screenWatch;
        if (!watchAfter.enabled) {
          debug('skip after LLM: watch disabled during inflight');
          return;
        }
        if (!isVisionAvailable(settingsAfter.llm.provider)) {
          debug('skip after LLM: provider no longer vision-capable');
          return;
        }
        if (isInSilentHours(new Date(), watchAfter.silentHours)) {
          debug('skip after LLM: entered silent hours');
          return;
        }

        await processExternalResponse({ text: outcome.text, source: 'screen-watch' });
      } catch (err) {
        debug('tick error:', err);
      } finally {
        isObservingRef.current = false;
      }
    };

    // INITIAL_DELAY_MS 후 첫 tick, 이후 TICK_INTERVAL_MS마다
    initialTimerRef.current = setTimeout(() => {
      initialTimerRef.current = null;
      void tick();
      timerRef.current = setInterval(() => void tick(), TICK_INTERVAL_MS);
    }, INITIAL_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (initialTimerRef.current) {
        clearTimeout(initialTimerRef.current);
        initialTimerRef.current = null;
      }
      isObservingRef.current = false;
      lastObservationAtRef.current = 0;
      void screenWatchService.clearState();
    };
  }, [enabled, provider]);
}
