import type { OAuthProvider } from './types';

/**
 * Supabase 대시보드에 실제 등록된 provider 목록.
 * 신규 provider 클라이언트 ID 등록 후 이 배열에만 추가하면 UI 전체에 즉시 반영됨.
 * 예) Apple 등록 후: ['google', 'apple']
 */
export const ENABLED_PROVIDERS: OAuthProvider[] = ['google'];

/**
 * 등록된 provider의 버튼 아이콘 (ENABLED_PROVIDERS에 있는 것만 정의)
 * 미등록 provider는 의도적으로 제외 — 클라이언트 ID 등록 후 추가
 */
export const PROVIDER_ICONS: Partial<Record<OAuthProvider, string>> = {
  google: 'G',
  // apple: '' — 미등록
  // meta:  'f' — 미등록
  // x:     'X' — 미등록
};

/**
 * 등록된 provider의 버튼 스타일 (ENABLED_PROVIDERS에 있는 것만 정의)
 */
export const PROVIDER_COLORS: Partial<Record<OAuthProvider, string>> = {
  google: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  // apple: 'bg-black text-white hover:bg-gray-900'      — 미등록
  // meta:  'bg-[#1877F2] text-white hover:bg-[#166FE5]' — 미등록
  // x:     'bg-black text-white hover:bg-gray-900'      — 미등록
};

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
