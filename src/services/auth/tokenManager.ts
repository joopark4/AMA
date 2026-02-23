import type { AuthTokens } from './types';

/** 토큰 만료 여부 확인 (5분 여유 포함) */
export function isTokenExpired(tokens: AuthTokens): boolean {
  const BUFFER_MS = 5 * 60 * 1000;
  return Date.now() >= tokens.expiresAt - BUFFER_MS;
}

/** expiresIn(초) → expiresAt(Unix ms) 변환 */
export function toExpiresAt(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000;
}
