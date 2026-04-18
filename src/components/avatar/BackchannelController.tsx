import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAvatarStore } from '../../stores/avatarStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Backchannel Controller (v2 — 3순위)
 *
 * 사용자가 말하는 동안(status === 'listening') 아바타가 주기적으로 짧게 고개를 끄덕임.
 * "듣고 있어요" 신호를 비언어적으로 전달.
 *
 * 구현 노트:
 * - 모션 클립 없이 head/neck 본을 직접 sine 곡선으로 회전 (additive, +x pitch).
 *   motion catalog가 비어있어도 작동.
 * - 음성 입력 RMS 스트림이 없으므로 listening 상태 동안 2~4초 랜덤 간격으로 트리거 (근사).
 * - 드래그 중엔 스킵.
 */

const NOD_INTERVAL_MIN_MS = 2_000;
const NOD_INTERVAL_MAX_MS = 4_000;
const NOD_DURATION_MS = 500;
const NOD_AMPLITUDE_HEAD = 0.15; // 라디안 (~8.6°)
const NOD_AMPLITUDE_NECK = 0.06;

export default function BackchannelController() {
  const vrm = useAvatarStore((state) => state.vrm);
  const status = useConversationStore((state) => state.status);
  const isDragging = useAvatarStore((state) => state.isDragging);
  const enabled = useSettingsStore(
    (state) => state.settings.avatar?.animation?.backchannel ?? true
  );

  const nodActiveRef = useRef(false);
  const nodStartedAtRef = useRef(0);
  const nextNodAtRef = useRef(0);

  const active = enabled && status === 'listening' && !isDragging;

  useEffect(() => {
    if (active) {
      const delay = NOD_INTERVAL_MIN_MS + Math.random() * (NOD_INTERVAL_MAX_MS - NOD_INTERVAL_MIN_MS);
      nextNodAtRef.current = performance.now() + delay;
    } else {
      nodActiveRef.current = false;
      nextNodAtRef.current = 0;
    }
  }, [active]);

  useFrame(() => {
    if (!vrm?.humanoid) return;
    if (!active) {
      nodActiveRef.current = false;
      return;
    }

    const now = performance.now();

    // 새 nod 시작
    if (!nodActiveRef.current && now >= nextNodAtRef.current && nextNodAtRef.current > 0) {
      nodActiveRef.current = true;
      nodStartedAtRef.current = now;
    }

    if (!nodActiveRef.current) return;

    const elapsed = now - nodStartedAtRef.current;
    const progress = elapsed / NOD_DURATION_MS;

    if (progress >= 1) {
      nodActiveRef.current = false;
      // 다음 nod 예약
      const delay = NOD_INTERVAL_MIN_MS + Math.random() * (NOD_INTERVAL_MAX_MS - NOD_INTERVAL_MIN_MS);
      nextNodAtRef.current = now + delay;
      return;
    }

    // 더블 bob: 두 번 고개 끄덕임 (두 번째는 약간 작게)
    const phase = progress * Math.PI * 2; // 0 → 2π
    const envelope = 1 - progress * 0.3; // 1.0 → 0.7 (점차 감쇠)
    const intensity = Math.abs(Math.sin(phase)) * envelope;

    const headBone = vrm.humanoid.getNormalizedBoneNode('head');
    const neckBone = vrm.humanoid.getNormalizedBoneNode('neck');

    if (headBone) {
      headBone.rotation.x += NOD_AMPLITUDE_HEAD * intensity;
    }
    if (neckBone) {
      neckBone.rotation.x += NOD_AMPLITUDE_NECK * intensity;
    }
  });

  return null;
}
