/**
 * useClaudeCodeChat — Claude Code 응답 처리를 useConversation에서 분리한 훅
 *
 * handleClaudeCodeResponse 로직을 캡슐화하여
 * useConversation 코어에서 Channels 의존성을 제거한다.
 */

import { useCallback } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import { useAvatarStore, type Emotion } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { llmRouter } from '../../services/ai/llmRouter';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { emotionTuningGlobal, getEmotionTuning } from '../../config/emotionTuning';
import { selectMotionClip } from '../../services/avatar/motionSelector';
import type { Message as LLMMessage } from '../../services/ai/types';
import { invoke } from '@tauri-apps/api/core';
import { CLAUDE_CODE_PROVIDER } from './constants';

const log = (...args: unknown[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[ClaudeCodeChat]', ...args);
  invoke('log_to_terminal', { message: `[ClaudeCodeChat] ${message}` }).catch(() => {});
};

const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  neutral: [],
  happy: ['happy', 'great', 'love', 'awesome', '좋아', '행복', '기뻐', '최고', '고마워'],
  sad: ['sad', 'sorry', 'unfortunately', '슬퍼', '미안', '힘들', '우울', '걱정'],
  angry: ['angry', 'annoyed', 'frustrated', '화나', '짜증', '열받', '빡쳐'],
  surprised: ['wow', 'surprised', 'amazing', '대박', '놀라', '헉', '와'],
  relaxed: ['calm', 'relaxed', 'peaceful', '차분', '편안', '여유'],
  thinking: ['think', 'maybe', 'hmm', '음', '생각', '고민', '글쎄'],
};

function analyzeEmotion(text: string): { emotion: Emotion; score: number } {
  const normalized = text.toLowerCase();
  let best: { emotion: Emotion; score: number } = { emotion: 'neutral', score: 0 };

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as [Emotion, string[]][]) {
    if (emotion === 'neutral') continue;
    let score = 0;
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) score += 1;
    }
    if (score > best.score) {
      best = { emotion, score };
    }
  }

  return best;
}

function buildSystemPrompt(avatarName: string, personalityPrompt: string): string {
  const normalizedName = avatarName.trim() || '아바타';
  const basePrompt = `당신은 "${normalizedName}"이라는 이름의 친근하고 귀여운 AI 어시스턴트입니다.
성격: 밝고 긍정적이며, 사용자를 친구처럼 대합니다.
말투: 반말을 사용하고, 짧고 자연스러운 대화체로 말합니다.
특징:
- 이모티콘은 사용하지 않습니다
- 답변은 2-3문장 정도로 짧게 합니다
- 공감과 감정 표현을 잘합니다
- 한국어로 대화합니다`;

  const normalizedPersonalityPrompt = personalityPrompt.trim();
  if (!normalizedPersonalityPrompt) {
    return basePrompt;
  }

  return `${basePrompt}

추가 성격 가이드(사용자 지정):
${normalizedPersonalityPrompt}

위 사용자 지정 가이드를 기본 성격과 함께 우선 반영하세요.`;
}

export function useClaudeCodeChat() {
  const {
    addMessage,
    setCurrentResponse,
    setStatus,
    clearCurrentResponse,
  } = useConversationStore();

  const {
    setEmotion,
    triggerMotionClip,
    registerMotionSelection,
    startDancing,
    stopDancing,
  } = useAvatarStore();

  const { speak } = useSpeechSynthesis();

  const triggerEmotionMotion = useCallback(
    (emotion: Emotion, score: number, _text: string, preferSpeakingContext = false) => {
      const settingsState = useSettingsStore.getState().settings;
      const avatarState = useAvatarStore.getState();
      const conversationState = useConversationStore.getState();
      const faceOnlyModeEnabled =
        settingsState.avatar?.animation?.faceExpressionOnlyMode ?? false;
      const clipsEnabled = settingsState.avatar?.animation?.enableMotionClips ?? true;
      const diversityStrength = settingsState.avatar?.animation?.motionDiversity ?? 1;
      const dynamicMotionEnabled =
        settingsState.avatar?.animation?.dynamicMotionEnabled ?? false;
      const dynamicMotionBoost = dynamicMotionEnabled
        ? settingsState.avatar?.animation?.dynamicMotionBoost ?? 1.0
        : 0;

      if (faceOnlyModeEnabled) return;

      if (clipsEnabled) {
        const selection = selectMotionClip({
          emotion,
          emotionScore: score,
          isSpeaking: preferSpeakingContext || conversationState.status === 'speaking',
          isMoving: avatarState.isMoving,
          diversityStrength,
          dynamicBoost: dynamicMotionBoost,
          recentMotionIds: avatarState.recentMotionIds,
          cooldownMap: avatarState.motionCooldownMap,
          now: Date.now(),
        });

        if (selection.selected) {
          registerMotionSelection(selection.selected.id, selection.selected.cooldown_ms);
          triggerMotionClip(selection.selected.id);
        }
      }
    },
    [registerMotionSelection, triggerMotionClip]
  );

  const sendToClaudeCode = useCallback(async (
    text: string,
    onError?: (message: string) => void,
  ) => {
    log('sending to Claude Code');
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
        ...currentMessages.map((m) => ({
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
      setCurrentResponse(responseText);
      setStatus('speaking');

      await new Promise(resolve => setTimeout(resolve, 50));
      try {
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
  }, [addMessage, setCurrentResponse, clearCurrentResponse, setStatus, setEmotion, speak, triggerEmotionMotion, startDancing, stopDancing]);

  /** provider가 claude_code인지 확인 */
  const isClaudeCodeProvider = useCallback((): boolean => {
    return useSettingsStore.getState().settings.llm.provider === CLAUDE_CODE_PROVIDER;
  }, []);

  return { sendToClaudeCode, isClaudeCodeProvider };
}
