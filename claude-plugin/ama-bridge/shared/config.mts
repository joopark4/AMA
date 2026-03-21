/**
 * 공유 설정 — 포트/경로 중앙 관리
 */

export const PORTS = {
  CI_WEBHOOK: parseInt(process.env.WEBHOOK_PORT ?? '8788', 10),
  MONITOR_ALERT: parseInt(process.env.ALERT_PORT ?? '8789', 10),
  DEV_BRIDGE: parseInt(process.env.BRIDGE_PORT ?? '8790', 10),
  AMA_SPEAK: parseInt(process.env.AMA_SPEAK_PORT ?? '8791', 10),
} as const;

export const AMA_TOKEN_PATH = (() => {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return `${home}/.mypartnerai/mcp-token`;
})();

export const MAX_TEXT_LENGTH = 1000;
