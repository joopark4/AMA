export type OAuthProvider = 'google' | 'apple' | 'meta' | 'x';

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  provider: OAuthProvider;
  avatarUrl?: string;
  createdAt: number;
  /** 향후 서버 측 추가 데이터 확장용 */
  metadata?: Record<string, unknown>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  /** Unix timestamp (ms) */
  expiresAt: number;
}

export interface OAuthInitResult {
  authUrl: string;
  state: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface IAuthService {
  initiateOAuth(provider: OAuthProvider, pkceChallenge: string, state: string): Promise<OAuthInitResult>;
  handleCallback(code: string, state: string, pkceVerifier: string): Promise<AuthResult>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  logout(accessToken: string): Promise<void>;
  deleteAccount(accessToken: string): Promise<void>;
}
