import { useEffect, useRef } from 'react';
import { useAvatarStore, type Emotion } from '../../stores/avatarStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { getMotionManifest } from '../../services/avatar/motionLibrary';
import { buildMotionNarration } from '../../services/avatar/motionNarration';
import type { MotionClipMeta } from '../../types/motion';

const ANNOUNCE_TO_MOTION_GAP_MS = 120;
const MOTION_END_PADDING_MS = 220;
const BETWEEN_MOTIONS_GAP_MS = 120;
const WAIT_SLICE_MS = 80;

function resolveEmotionFromTags(tags: MotionClipMeta['emotion_tags']): Emotion {
  const nonBridge = tags.find((tag) => tag !== 'bridge');

  switch (nonBridge) {
    case 'neutral':
    case 'happy':
    case 'sad':
    case 'angry':
    case 'surprised':
    case 'thinking':
    case 'relaxed':
      return nonBridge;
    default:
      return 'neutral';
  }
}

async function waitWithCancel(ms: number, shouldCancel: () => boolean): Promise<boolean> {
  let remain = ms;
  while (remain > 0) {
    if (shouldCancel()) return false;
    const chunk = Math.min(WAIT_SLICE_MS, remain);
    await new Promise((resolve) => setTimeout(resolve, chunk));
    remain -= chunk;
  }
  return !shouldCancel();
}

export default function MotionSequenceDemoController() {
  if (!import.meta.env.DEV) {
    return null;
  }

  const isMotionSequenceActive = useAvatarStore((state) => state.isMotionSequenceActive);
  const isLoaded = useAvatarStore((state) => state.isLoaded);
  const {
    setEmotion,
    triggerMotionClip,
    clearMotionClip,
    registerMotionSelection,
    resetGestures,
    setMotionSequenceIndex,
    stopMotionSequenceDemo,
  } = useAvatarStore();
  const { setCurrentResponse } = useConversationStore();
  const { speak, stop } = useSpeechSynthesis();
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!isMotionSequenceActive) {
      return;
    }

    const currentRunId = ++runIdRef.current;
    let cancelled = false;

    const shouldCancel = () =>
      cancelled ||
      currentRunId !== runIdRef.current ||
      !useAvatarStore.getState().isMotionSequenceActive;

    const finalize = () => {
      setCurrentResponse(null);
      setEmotion('neutral');
      clearMotionClip();
      stopMotionSequenceDemo();
    };

    const run = async () => {
      if (!isLoaded) {
        const language = useSettingsStore.getState().settings.language;
        const message =
          language === 'en'
            ? 'Avatar model is not loaded. Please load a VRM model first.'
            : language === 'ja'
            ? 'アバターモデルが読み込まれていません。先にVRMモデルを選択してください。'
            : '아바타 모델이 로드되지 않았습니다. 먼저 VRM 모델을 선택해 주세요.';
        setCurrentResponse(message);
        try {
          await speak(message);
        } catch {
          // no-op
        }
        finalize();
        return;
      }

      const clips = getMotionManifest();
      if (clips.length === 0) {
        finalize();
        return;
      }

      resetGestures();
      clearMotionClip();

      for (let index = 0; index < clips.length; index += 1) {
        if (shouldCancel()) break;

        const clip = clips[index];
        setMotionSequenceIndex(index);

        const language = useSettingsStore.getState().settings.language;
        const narration = buildMotionNarration(clip, index, clips.length, language);
        setCurrentResponse(narration);

        try {
          await speak(narration);
        } catch {
          // Ignore TTS errors and continue the motion demo.
        }

        if (!await waitWithCancel(ANNOUNCE_TO_MOTION_GAP_MS, shouldCancel)) break;

        setCurrentResponse(null);
        setEmotion(resolveEmotionFromTags(clip.emotion_tags));
        registerMotionSelection(clip.id, clip.cooldown_ms);
        triggerMotionClip(clip.id);

        const playbackWindow = Math.max(450, clip.duration_ms + MOTION_END_PADDING_MS);
        if (!await waitWithCancel(playbackWindow, shouldCancel)) break;

        if (useAvatarStore.getState().currentMotionClip === clip.id) {
          clearMotionClip();
        }

        if (!await waitWithCancel(BETWEEN_MOTIONS_GAP_MS, shouldCancel)) break;
      }

      finalize();
    };

    void run();

    return () => {
      cancelled = true;
      runIdRef.current += 1;
      stop();
      setCurrentResponse(null);
      clearMotionClip();
    };
  }, [
    clearMotionClip,
    isLoaded,
    isMotionSequenceActive,
    registerMotionSelection,
    resetGestures,
    setCurrentResponse,
    setEmotion,
    setMotionSequenceIndex,
    speak,
    stop,
    stopMotionSequenceDemo,
    triggerMotionClip,
  ]);

  return null;
}
