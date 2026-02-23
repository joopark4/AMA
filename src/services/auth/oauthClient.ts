import type { OAuthProvider } from './types';

/**
 * Supabase 대시보드에 실제 등록된 provider 목록.
 * 신규 provider 등록 후 이 배열에만 추가하면 UI 전체에 즉시 반영됨.
 * Apple, Meta, X 등록 후: ['google', 'apple', 'meta', 'x']
 */
export const ENABLED_PROVIDERS: OAuthProvider[] = ['google'];

/** Supabase env vars 미설정 시 Mock 모드로 동작 */
export function isMockMode(): boolean {
  return !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;
}

/** PKCE code_verifier 및 code_challenge(S256) 생성 (향후 재사용 대비 유지) */
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(64);
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

/** CSRF 방지용 state 값 생성 (향후 재사용 대비 유지) */
export function generateState(): string {
  return generateRandomString(32);
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
