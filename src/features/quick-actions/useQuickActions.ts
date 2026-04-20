/**
 * Quick Actions dispatch 훅.
 *
 * 호출 측에서 `useConversation()`을 통해 확보한 `sendMessage`를 넘겨받아
 * `runQuickAction`이 핸들러로 라우팅한다. 클립보드는 navigator API 사용
 * (Tauri 데스크탑 환경에서도 동작).
 */
import { useCallback } from 'react';
import { runQuickAction } from './catalog';
import type { QuickActionId } from './types';

interface UseQuickActionsOptions {
  sendMessage: (text: string) => Promise<void> | void;
}

export function useQuickActions({ sendMessage }: UseQuickActionsOptions) {
  const dispatch = useCallback(
    async (id: QuickActionId) => {
      await runQuickAction(id, {
        sendMessage,
        readClipboard: async () => {
          try {
            return (await navigator.clipboard.readText()) ?? '';
          } catch {
            return '';
          }
        },
      });
    },
    [sendMessage]
  );

  return { dispatch };
}
