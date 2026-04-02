/**
 * useClaudeCodeChat — Claude Code 응답 처리를 useConversation에서 분리한 훅
 *
 * handleClaudeCodeResponse 로직을 캡슐화하여
 * useConversation 코어에서 Channels 의존성을 제거한다.
 */

import { useCallback, useRef } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { llmRouter } from '../../services/ai/llmRouter';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { emotionTuningGlobal, getEmotionTuning } from '../../config/emotionTuning';
import { buildSystemPrompt } from '../../hooks/useConversation';
import type { Message as LLMMessage } from '../../services/ai/types';
import { invoke } from '@tauri-apps/api/core';
import { analyzeEmotion, triggerEmotionMotion } from './responseProcessor';
import { CLAUDE_CODE_PROVIDER } from './constants';

const log = (...args: unknown[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[ClaudeCodeChat]', ...args);
  invoke('log_to_terminal', { message: `[ClaudeCodeChat] ${message}` }).catch(() => {});
};

export function useClaudeCodeChat() {
  const {
    addMessage,
    setCurrentResponse,
    setStatus,
    clearCurrentResponse,
  } = useConversationStore();

  const {
    setEmotion,
    startDancing,
    stopDancing,
  } = useAvatarStore();

  const { speak, stop: stopSpeaking } = useSpeechSynthesis();
  const requestIdRef = useRef(0);

  const sendToClaudeCode = useCallback(async (
    text: string,
    onError?: (message: string) => void,
  ) => {
    const myRequestId = ++requestIdRef.current;
    log('sending to Claude Code, requestId:', myRequestId);
    addMessage({ role: 'user', content: text });
    setEmotion('thinking');

    const settings = useSettingsStore.getState().settings;

    try {
      const currentMessages = useConversationStore.getState().messages;
      const systemPrompt = buildSystemPrompt(
        settings.avatarName || '',
        settings.avatarPersonalityPrompt || ''
      );
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...currentMessages
          .filter((m) => m.source !== 'external')
          .map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
      ];

      const response = await llmRouter.chat(llmMessages, {
        temperature: 0.7,
        maxTokens: 1024,
      });
      const responseText = response.content;
      log('response received:', responseText?.substring(0, 50) + '...');

      const responseEmotionMatch = analyzeEmotion(responseText);
      const responseEmotion =
        responseEmotionMatch.score > 0 ? responseEmotionMatch.emotion : 'neutral';
      const faceOnlyModeEnabled =
        useSettingsStore.getState().settings.avatar?.animation?.faceExpressionOnlyMode ?? false;

      if (responseEmotionMatch.score > 0) {
        setEmotion(responseEmotionMatch.emotion);
        triggerEmotionMotion(responseEmotionMatch.emotion, responseEmotionMatch.score, responseText, true);
        if (!faceOnlyModeEnabled && responseEmotionMatch.emotion === 'happy') {
          startDancing();
          setTimeout(() => stopDancing(), emotionTuningGlobal.happyDanceMs);
        }
      } else {
        stopDancing();
      }

      addMessage({ role: 'assistant', content: responseText });

      // 최신 요청만 TTS 재생 (이전 응답은 메시지만 저장)
      if (myRequestId === requestIdRef.current) {
        setCurrentResponse(responseText);
        setStatus('speaking');
        await new Promise(resolve => setTimeout(resolve, 50));
        try {
          stopSpeaking();
          await speak(responseText, { emotion: responseEmotion });
        } catch (ttsErr) {
          log('TTS error:', ttsErr);
        }

        setStatus('idle');
        const responseHoldMs = Math.max(
          emotionTuningGlobal.responseClearMs,
          getEmotionTuning(responseEmotion).expressionHoldMs
        );
        setTimeout(() => {
          setEmotion('neutral');
          clearCurrentResponse();
        }, responseHoldMs);
      } else {
        log('skipping TTS for older request', myRequestId, '(current:', requestIdRef.current, ')');
      }
    } catch (err) {
      log('error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Claude Code 응답 실패';
      onError?.(errorMsg);
      setStatus('error');
      setEmotion('sad');
      setTimeout(() => {
        setStatus('idle');
        setEmotion('neutral');
      }, 5000);
    }
  }, [addMessage, setCurrentResponse, clearCurrentResponse, setStatus, setEmotion, speak, stopSpeaking, startDancing, stopDancing]);

  /** provider가 claude_code인지 확인 */
  const isClaudeCodeProvider = useCallback((): boolean => {
    return useSettingsStore.getState().settings.llm.provider === CLAUDE_CODE_PROVIDER;
  }, []);

  return { sendToClaudeCode, isClaudeCodeProvider };
}
