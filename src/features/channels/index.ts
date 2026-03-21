/**
 * Claude Code Channels 모듈 — 퍼블릭 API
 */

export { ClaudeCodeClient, claudeCodeClient } from './claudeCodeClient';
export { useMcpSpeakListener } from './useMcpSpeakListener';
export { processExternalResponse, analyzeEmotion, triggerEmotionMotion } from './responseProcessor';
export type { ProcessResponseOptions } from './responseProcessor';
export { useClaudeCodeChat } from './useClaudeCodeChat';
export { default as MCPSettings } from './MCPSettings';
export { CLAUDE_CODE_PROVIDER, BRIDGE_DEFAULT_ENDPOINT, BRIDGE_DEFAULT_MODEL } from './constants';
