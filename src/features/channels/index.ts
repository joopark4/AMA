/**
 * Claude Code Channels 모듈 — 퍼블릭 API
 */

// 상수
export { CLAUDE_CODE_PROVIDER, BRIDGE_DEFAULT_ENDPOINT, BRIDGE_DEFAULT_MODEL } from './constants';

// 클라이언트
export { ClaudeCodeClient, claudeCodeClient } from './claudeCodeClient';

// 훅
export { useClaudeCodeChat } from './useClaudeCodeChat';
export { useMcpSpeakListener } from './useMcpSpeakListener';

// 유틸
export { processExternalResponse, analyzeEmotion, triggerEmotionMotion } from './responseProcessor';
export type { ProcessResponseOptions } from './responseProcessor';

// 컴포넌트
export { default as MCPSettings } from './MCPSettings';
