import { useEffect, useRef } from 'react';
import { useAvatarStore } from '../../stores/avatarStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Backchannel Controller (v2 — 3순위)
 *
 * 사용자가 말하는 동안(status === 'listening') 아바타가 주기적으로 짧게 고개 끄덕임.
 * "듣고 있어요" 신호를 비언어적으로 전달.
 *
 * 동작 조건:
 * - `avatar.animation.backchannel` 설정 ON (기본 true)
 * - conversationStore.status === 'listening'
 * - 현재 제스처가 진행 중이 아님 (덮어쓰지 않음)
 *
 * 구현 노트:
 * - 마이크 RMS 스트림이 없어 실제 음성 피크에 동기화는 못함 (현재 STT는 bulk 녹음)
 * - 대신 listening 상태 동안 랜덤 간격(2~4s)으로 nod 트리거 — 자연스러운 맞장구 근사치
 */

const NOD_INTERVAL_MIN_MS = 2_000;
const NOD_INTERVAL_MAX_MS = 4_000;

export default function BackchannelController() {
  const enabled = useSettingsStore(
    (state) => state.settings.avatar?.animation?.backchannel ?? true
  );
  const status = useConversationStore((state) => state.status);
  const triggerGesture = useAvatarStore((state) => state.triggerGesture);
  const currentGesture = useAvatarStore((state) => state.currentGesture);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentGestureRef = useRef(currentGesture);
  currentGestureRef.current = currentGesture;

  useEffect(() => {
    if (!enabled || status !== 'listening') {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const scheduleNext = () => {
      const delay = NOD_INTERVAL_MIN_MS + Math.random() * (NOD_INTERVAL_MAX_MS - NOD_INTERVAL_MIN_MS);
      timerRef.current = setTimeout(() => {
        // 현재 제스처가 없을 때만 nod 트리거 (기존 제스처 덮어쓰지 않음)
        if (currentGestureRef.current === null) {
          triggerGesture('nod');
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, status, triggerGesture]);

  return null;
}
