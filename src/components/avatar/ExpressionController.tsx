import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { useConversationStore } from '../../stores/conversationStore';
import { emotionTuningGlobal, getEmotionTuning } from '../../config/emotionTuning';

// 매 프레임 배열 생성을 피하기 위해 모듈 레벨에 상수화
const EMOTION_EXPRESSIONS = ['happy', 'sad', 'angry', 'Surprised', 'relaxed', 'neutral'] as const;

const EMOTION_TO_EXPRESSION: Record<string, string> = {
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  surprised: 'Surprised',
  relaxed: 'relaxed',
  thinking: 'neutral',
  neutral: 'neutral',
};

export default function ExpressionController() {
  const { emotion, setEmotion, lipSyncValue } = useAvatarStore();
  const vrm = useAvatarStore((state) => state.vrm);
  const { status } = useConversationStore();

  // 사용 가능한 표정 이름 캐시 (VRM 변경 시 + 최초 마운트 시 갱신)
  const availableNamesRef = useRef<Set<string>>(new Set());
  const prevVrmRef = useRef<typeof vrm>(null);

  if (vrm !== prevVrmRef.current) {
    prevVrmRef.current = vrm;
    const names = new Set<string>();
    if (vrm?.expressionManager) {
      for (const e of vrm.expressionManager.expressions) {
        names.add(e.expressionName);
      }
    }
    availableNamesRef.current = names;
  }

  // idle 복귀 타이머 — useRef로 단일 타이머 보장
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 이전 타이머 정리
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    switch (status) {
      case 'processing':
        if (emotion === 'neutral') {
          setEmotion('thinking');
        }
        break;
      case 'error':
        setEmotion('sad');
        break;
      case 'idle': {
        if (emotion === 'neutral') break;
        const holdMs = Math.max(
          emotionTuningGlobal.idleNeutralDelayMs,
          getEmotionTuning(emotion).expressionHoldMs
        );
        idleTimerRef.current = setTimeout(() => {
          idleTimerRef.current = null;
          setEmotion('neutral');
        }, holdMs);
        break;
      }
    }

    return () => {
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [status, setEmotion, emotion]);

  useFrame(() => {
    if (!vrm?.expressionManager) return;

    const expressionManager = vrm.expressionManager;
    const available = availableNamesRef.current;

    // Reset all emotion expressions
    for (const name of EMOTION_EXPRESSIONS) {
      if (available.has(name)) {
        expressionManager.setValue(name, 0);
      }
    }

    // Set target expression
    const targetExpName = EMOTION_TO_EXPRESSION[emotion] || 'neutral';
    const intensity = getEmotionTuning(emotion).expressionIntensity;
    if (available.has(targetExpName)) {
      expressionManager.setValue(targetExpName, intensity);
    }

    // Lip sync
    if (available.has('aa')) {
      expressionManager.setValue('aa', lipSyncValue > 0 ? lipSyncValue * 0.8 : 0);
    }
  });

  return null;
}
