/**
 * MotionDemoSequence — 자동 배회 + 감정 반응 데모
 * 자동 배회를 켜고 감정을 순차 변경하여 걷기/점프/제스처 반응을 확인합니다.
 */
import { useEffect, useRef } from 'react';
import { useAvatarStore } from '../../stores/avatarStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { invoke } from '@tauri-apps/api/core';

const log = (msg: string) => {
  console.log(`[MotionDemo] ${msg}`);
  invoke('log_to_terminal', { message: `[MotionDemo] ${msg}` }).catch(() => {});
};

interface DemoStep {
  label: string;
  action: () => void;
  durationMs: number;
}

export default function MotionDemoSequence() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const avatar = useAvatarStore.getState;
    const settings = useSettingsStore.getState;

    const steps: DemoStep[] = [
      // 1. 자동 배회 ON
      {
        label: '1/10 자동 배회 ON — neutral로 걷기 시작',
        durationMs: 6000,
        action: () => {
          settings().setAvatarSettings({ autoRoam: true });
          avatar().setEmotion('neutral');
        },
      },
      // 2. happy → 축하 제스처 + bouncy 걷기
      {
        label: '2/10 감정 → happy (축하 제스처 + bouncy 걷기)',
        durationMs: 6000,
        action: () => avatar().setEmotion('happy'),
      },
      // 3. sad → 멈춤 + 슬픈 idle
      {
        label: '3/10 감정 → sad (멈춤 + 슬픈 대기)',
        durationMs: 5000,
        action: () => avatar().setEmotion('sad'),
      },
      // 4. angry → 빠른 걸음 + 고개 흔들기
      {
        label: '4/10 감정 → angry (brisk 걷기 + 고개 흔들기)',
        durationMs: 6000,
        action: () => avatar().setEmotion('angry'),
      },
      // 5. thinking → 느린 걷기
      {
        label: '5/10 감정 → thinking (sneak 걷기)',
        durationMs: 5000,
        action: () => avatar().setEmotion('thinking'),
      },
      // 6. surprised → 점프 리액션
      {
        label: '6/10 감정 → surprised (점프!)',
        durationMs: 5000,
        action: () => avatar().setEmotion('surprised'),
      },
      // 7. relaxed → 느긋한 걷기
      {
        label: '7/10 감정 → relaxed (stroll 걷기)',
        durationMs: 5000,
        action: () => avatar().setEmotion('relaxed'),
      },
      // 8. happy 다시 → 걷기 중 감정 전환 확인
      {
        label: '8/10 감정 → happy (걷기 중 전환)',
        durationMs: 5000,
        action: () => avatar().setEmotion('happy'),
      },
      // 9. neutral 복귀
      {
        label: '9/10 감정 → neutral 복귀',
        durationMs: 4000,
        action: () => avatar().setEmotion('neutral'),
      },
      // 10. 자동 배회 OFF
      {
        label: '10/10 자동 배회 OFF — 데모 종료',
        durationMs: 2000,
        action: () => {
          settings().setAvatarSettings({ autoRoam: false });
          avatar().setEmotion('neutral');
        },
      },
    ];

    let delay = 3000;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const step of steps) {
      timers.push(
        setTimeout(() => {
          log(step.label);
          step.action();
        }, delay),
      );
      delay += step.durationMs;
    }

    log(`데모 시작 (3초 후, 총 ${steps.length}단계, ${Math.round(delay / 1000)}초)`);

    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0; // 배열 참조 해제
      startedRef.current = false; // HMR/StrictMode 재실행 허용
      settings().setAvatarSettings({ autoRoam: false });
    };
  }, []);

  return null;
}
