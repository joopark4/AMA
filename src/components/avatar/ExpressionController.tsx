import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { emotionTuningGlobal, getEmotionTuning } from '../../config/emotionTuning';

export default function ExpressionController() {
  const { emotion, setEmotion, lipSyncValue } = useAvatarStore();
  const vrm = useAvatarStore((state) => state.vrm);
  const { status } = useConversationStore();
  useSettingsStore(); // Keep subscription for settings changes

  // Apply lightweight status-based overrides only when necessary.
  useEffect(() => {
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
        const timer = setTimeout(() => setEmotion('neutral'), holdMs);
        return () => clearTimeout(timer);
      }
    }
  }, [status, setEmotion, emotion]);

  // Direct expression setting (no complex blending)
  useFrame(() => {
    if (!vrm?.expressionManager) return;

    const expressionManager = vrm.expressionManager;
    const availableNames = expressionManager.expressions.map((e) => e.expressionName);

    // Reset all emotion expressions
    const emotionExpressions = ['happy', 'sad', 'angry', 'Surprised', 'relaxed', 'neutral'];
    emotionExpressions.forEach((name) => {
      if (availableNames.includes(name)) {
        expressionManager.setValue(name, 0);
      }
    });

    // Map emotion to VRM expression name
    const emotionToExpression: Record<string, string> = {
      happy: 'happy',
      sad: 'sad',
      angry: 'angry',
      surprised: 'Surprised',
      relaxed: 'relaxed',
      thinking: 'neutral',
      neutral: 'neutral',
    };

    const targetExpName = emotionToExpression[emotion] || 'neutral';
    const intensity = getEmotionTuning(emotion).expressionIntensity;
    if (availableNames.includes(targetExpName)) {
      expressionManager.setValue(targetExpName, intensity);
    }

    if (availableNames.includes('aa')) {
      expressionManager.setValue('aa', lipSyncValue > 0 ? lipSyncValue * 0.8 : 0);
    }
  });

  return null;
}
