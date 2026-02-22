import type { OAuthProvider } from './types';

/** OAuth 클라이언트 ID가 없으면 Mock 모드로 동작 */
export function isMockMode(provider: OAuthProvider): boolean {
  switch (provider) {
    case 'google': return !import.meta.env.VITE_GOOGLE_CLIENT_ID;
    case 'apple':  return !import.meta.env.VITE_APPLE_CLIENT_ID;
    case 'meta':   return !import.meta.env.VITE_META_APP_ID;
  }
}

/** PKCE code_verifier 및 code_challenge(S256) 생성 */
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(64);
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

/** CSRF 방지용 state 값 생성 */
export function generateState(): string {
  return generateRandomString(32);
}

/** provider별 OAuth Authorization URL 빌드 */
export function buildOAuthUrl(
  provider: OAuthProvider,
  pkceChallenge: string,
  state: string,
  redirectUri: string = 'mypartnerai://auth/callback'
): string {
  switch (provider) {
    case 'google':
      return buildGoogleUrl(pkceChallenge, state, redirectUri);
    case 'apple':
      return buildAppleUrl(pkceChallenge, state, redirectUri);
    case 'meta':
      return buildMetaUrl(state, redirectUri);
    default:
      throw new Error(`지원하지 않는 OAuth 제공자: ${provider}`);
  }
}

// ─── 내부 구현 ────────────────────────────────────────────────────────────────

function buildGoogleUrl(challenge: string, state: string, redirectUri: string): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID 환경변수가 설정되지 않았습니다');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function buildAppleUrl(challenge: string, state: string, redirectUri: string): string {
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
  if (!clientId) throw new Error('VITE_APPLE_CLIENT_ID 환경변수가 설정되지 않았습니다');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'name email',
    response_mode: 'query',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });
  return `https://appleid.apple.com/auth/authorize?${params}`;
}

function buildMetaUrl(state: string, redirectUri: string): string {
  // Meta(Facebook)는 PKCE를 지원하지 않아 state만 사용
  const appId = import.meta.env.VITE_META_APP_ID;
  if (!appId) throw new Error('VITE_META_APP_ID 환경변수가 설정되지 않았습니다');

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email public_profile',
    state,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

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
