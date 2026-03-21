/**
 * processExternalResponse — 외부(MCP) 및 내부 응답 표시 공유 파이프라인
 *
 * 대화 기록 저장 + 말풍선 표시 + 감정/모션 트리거 + TTS 재생을
 * 하나의 함수로 통합하여, useConversation과 MCP 리스너 모두에서 사용한다.
 */

import { useConversationStore } from '../../stores/conversationStore';
import { useAvatarStore, type Emotion } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { ttsRouter } from '../../services/voice/ttsRouter';
import { selectMotionClip } from '../../services/avatar/motionSelector';
import { emotionTuningGlobal, getEmotionTuning } from '../../config/emotionTuning';
import { invoke } from '@tauri-apps/api/core';

const log = (...args: unknown[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[responseProcessor]', ...args);
  invoke('log_to_terminal', { message: `[responseProcessor] ${message}` }).catch(() => {});
};

// --- 감정 분석 (useConversation에서 공유) ---
const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  neutral: [],
  happy: ['happy', 'great', 'love', 'awesome', '좋아', '행복', '기뻐', '최고', '고마워'],
  sad: ['sad', 'sorry', 'unfortunately', '슬퍼', '미안', '힘들', '우울', '걱정'],
  angry: ['angry', 'annoyed', 'frustrated', '화나', '짜증', '열받', '빡쳐'],
  surprised: ['wow', 'surprised', 'amazing', '대박', '놀라', '헉', '와'],
  relaxed: ['calm', 'relaxed', 'peaceful', '차분', '편안', '여유'],
  thinking: ['think', 'maybe', 'hmm', '음', '생각', '고민', '글쎄'],
};

export function analyzeEmotion(text: string): { emotion: Emotion; score: number } {
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

// --- 모션 트리거 (useConversation에서 공유) ---
export function triggerEmotionMotion(
  emotion: Emotion,
  score: number,
  text: string,
  preferSpeakingContext = false
): void {
  const settingsState = useSettingsStore.getState().settings;
  const avatarState = useAvatarStore.getState();
  const conversationState = useConversationStore.getState();
  const faceOnlyModeEnabled =
    settingsState.avatar?.animation?.faceExpressionOnlyMode ?? false;
  const clipsEnabled = settingsState.avatar?.animation?.enableMotionClips ?? true;
  const gesturesEnabled = settingsState.avatar?.animation?.enableGestures ?? true;
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
      avatarState.registerMotionSelection(selection.selected.id, selection.selected.cooldown_ms);
      avatarState.triggerMotionClip(selection.selected.id);
      return;
    }
  }

  if (gesturesEnabled) {
    const gesture = pickGesture(emotion, text);
    if (gesture) {
      avatarState.triggerGesture(gesture);
    }
  }
}

function pickGesture(emotion: Emotion, text: string): 'wave' | 'nod' | 'shake' | 'shrug' | 'thinking' | 'celebrate' | null {
  const normalized = text.toLowerCase();
  if (/(안녕|hello|hi|bye|잘가)/i.test(normalized)) return 'wave';
  if (emotion === 'happy') return 'celebrate';
  if (emotion === 'surprised') return 'nod';
  if (emotion === 'sad') return 'thinking';
  if (emotion === 'angry') return 'shake';
  if (emotion === 'thinking') return 'thinking';
  if (emotion === 'relaxed') return 'nod';
  return null;
}

// --- 립싱크 ---
let lipSyncInterval: ReturnType<typeof setInterval> | null = null;

function startLipSync(): void {
  stopLipSync();
  let phase = 0;
  lipSyncInterval = setInterval(() => {
    phase += 0.3;
    const lipValue = Math.abs(Math.sin(phase)) * 0.7 + Math.random() * 0.3;
    useAvatarStore.getState().setLipSyncValue(Math.min(1, lipValue));
  }, 80);
}

function stopLipSync(): void {
  if (lipSyncInterval) {
    clearInterval(lipSyncInterval);
    lipSyncInterval = null;
  }
  useAvatarStore.getState().setLipSyncValue(0);
}

// --- 메인 함수 ---
export interface ProcessResponseOptions {
  text: string;
  emotion?: string;
  source?: 'internal' | 'external';
}

/**
 * 외부/내부 응답을 통합 파이프라인으로 처리한다.
 *
 * 1. 대화 기록 저장
 * 2. 말풍선 표시
 * 3. 감정 설정 + 모션 트리거
 * 4. TTS 재생 (외부 소스는 로컬 Supertonic만)
 * 5. 정리 (감정 초기화 + 말풍선 타이머)
 */
export async function processExternalResponse(options: ProcessResponseOptions): Promise<void> {
  const { text, source = 'external' } = options;
  const store = useConversationStore.getState();
  const avatarStore = useAvatarStore.getState();

  // 감정 결정: 명시적 지정 우선, 없으면 텍스트 분석
  const emotionMatch = analyzeEmotion(text);
  let emotion: Emotion = 'neutral';
  if (options.emotion && isValidEmotion(options.emotion)) {
    emotion = options.emotion as Emotion;
  } else if (emotionMatch.score > 0) {
    emotion = emotionMatch.emotion;
  }

  log(`Processing ${source} response:`, text.substring(0, 50), `emotion=${emotion}`);

  // 1. 대화 기록 저장
  store.addMessage({ role: 'assistant', content: text });

  // 2. 말풍선 표시
  store.setCurrentResponse(text);
  store.setStatus('speaking');

  // 3. 감정 설정 + 모션 트리거
  avatarStore.setEmotion(emotion);
  if (emotionMatch.score > 0 || emotion !== 'neutral') {
    triggerEmotionMotion(emotion, Math.max(emotionMatch.score, 1), text, true);

    const faceOnlyModeEnabled =
      useSettingsStore.getState().settings.avatar?.animation?.faceExpressionOnlyMode ?? false;
    if (!faceOnlyModeEnabled && emotion === 'happy') {
      avatarStore.startDancing();
      setTimeout(() => avatarStore.stopDancing(), emotionTuningGlobal.happyDanceMs);
    }
  }

  // 4. TTS 재생
  await new Promise(resolve => setTimeout(resolve, 50)); // React 렌더 대기

  try {
    startLipSync();

    // MCP 외부 경로든 내부든 ttsRouter.playAudio 사용
    // 외부 소스의 경우 클라우드 TTS 차단은 향후 ttsRouter에 옵션 추가로 처리
    await ttsRouter.playAudio(text, { emotion });

    log('TTS completed');
  } catch (err) {
    log('TTS error:', err);
  } finally {
    stopLipSync();
  }

  // 5. 정리
  store.setStatus('idle');
  const responseHoldMs = Math.max(
    emotionTuningGlobal.responseClearMs,
    getEmotionTuning(emotion).expressionHoldMs
  );
  setTimeout(() => {
    useAvatarStore.getState().setEmotion('neutral');
    useConversationStore.getState().clearCurrentResponse();
    log('Response cleared after', responseHoldMs, 'ms');
  }, responseHoldMs);
}

function isValidEmotion(value: string): boolean {
  return ['neutral', 'happy', 'sad', 'angry', 'surprised', 'relaxed', 'thinking'].includes(value);
}
