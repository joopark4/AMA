/**
 * useMcpSpeakListener — MCP 채널의 speak 이벤트를 수신하여 아바타 TTS를 처리
 *
 * Tauri 이벤트 'mcp-speak'를 수신하고 SpeakQueue를 통해
 * 순차적으로 processExternalResponse()를 호출한다.
 *
 * - 설정에서 mcpEnabled가 false이면 이벤트를 무시
 * - urgent: 현재 재생 중단 + 큐 앞에 삽입
 * - normal: 큐 뒤에 추가
 * - 큐 최대 5개 (초과 시 오래된 것 폐기)
 * - 사용자 대화 중(isProcessing)이면 대기
 */

import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { processExternalResponse } from '../utils/responseProcessor';
import { ttsRouter } from '../services/voice/ttsRouter';
import { invoke } from '@tauri-apps/api/core';

const log = (...args: unknown[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log('[McpSpeak]', ...args);
  invoke('log_to_terminal', { message: `[McpSpeak] ${message}` }).catch(() => {});
};

interface SpeakPayload {
  text: string;
  source: string;
  priority: 'normal' | 'urgent';
  emotion?: string;
  voice?: string;
}

interface QueueItem {
  text: string;
  source: string;
  priority: 'normal' | 'urgent';
  emotion?: string;
}

const MAX_QUEUE_SIZE = 5;

export function useMcpSpeakListener(): void {
  const queueRef = useRef<QueueItem[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    const processQueue = async () => {
      if (isPlayingRef.current) return;
      if (queueRef.current.length === 0) return;

      // 설정에서 MCP가 비활성화되어 있으면 큐를 비우고 중단
      if (!useSettingsStore.getState().settings.mcpEnabled) {
        queueRef.current.length = 0;
        return;
      }

      // 사용자 대화 중이면 대기
      const { isProcessing, isSpeaking } = useConversationStore.getState();
      if (isProcessing || isSpeaking) {
        setTimeout(processQueue, 1000);
        return;
      }

      isPlayingRef.current = true;
      const item = queueRef.current.shift()!;

      log(`Processing queue item: "${item.text.substring(0, 30)}..." source=${item.source} emotion=${item.emotion}`);

      try {
        await processExternalResponse({
          text: item.text,
          emotion: item.emotion,
          source: 'external',
        });
      } catch (err) {
        log('processExternalResponse error:', err);
      }

      isPlayingRef.current = false;

      // 다음 항목 처리
      if (queueRef.current.length > 0) {
        setTimeout(processQueue, 500);
      }
    };

    const handleSpeakEvent = (payload: SpeakPayload) => {
      // MCP 비활성화 시 이벤트 무시
      if (!useSettingsStore.getState().settings.mcpEnabled) {
        log('MCP disabled, ignoring speak event');
        return;
      }

      log(`Received mcp-speak: "${payload.text.substring(0, 30)}..." priority=${payload.priority} source=${payload.source}`);

      const item: QueueItem = {
        text: payload.text,
        source: payload.source,
        priority: payload.priority,
        emotion: payload.emotion,
      };

      if (payload.priority === 'urgent') {
        // urgent: 현재 재생 중단 + 큐 앞에 삽입
        ttsRouter.stopPlayback();
        isPlayingRef.current = false;
        queueRef.current.unshift(item);
      } else {
        // normal: 큐 뒤에 추가
        queueRef.current.push(item);
      }

      // 큐 크기 제한 (뒤에서 제거)
      while (queueRef.current.length > MAX_QUEUE_SIZE) {
        const discarded = queueRef.current.pop();
        log('Queue overflow, discarded:', discarded?.text.substring(0, 30));
      }

      // 토스트 알림
      window.dispatchEvent(new CustomEvent('ama-toast', {
        detail: {
          type: 'info',
          messageKey: 'mcp.receivedMessage',
          message: `[${payload.source}] 메시지 수신`,
        },
      }));

      // 큐 처리 시작
      processQueue();
    };

    const unlisten = listen<SpeakPayload>('mcp-speak', (event) => {
      handleSpeakEvent(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
