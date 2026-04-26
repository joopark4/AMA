/**
 * Edge Function 호출 래퍼 — supabase.functions.invoke() 기반
 * persistSession: false 환경에서 setSession()으로 세션 복원 후
 * Supabase 클라이언트가 인증을 자동 처리하도록 위임.
 *
 * arraybuffer 응답 시에는 raw fetch()를 사용하여 응답 헤더를 보존합니다.
 */
import { useAuthStore } from '../../stores/authStore';
import { supabase } from './supabaseClient';

interface CallOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  responseType?: 'json' | 'arraybuffer';
}

/** 세션 복원 싱글턴 — 동시 호출 시 한 번만 실행 */
let restorePromise: Promise<void> | null = null;
let sessionRestored = false;

export async function ensureSession(): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  if (sessionRestored) return;

  if (restorePromise) {
    return restorePromise;
  }

  restorePromise = doRestoreSession();
  try {
    await restorePromise;
  } finally {
    restorePromise = null;
  }
}

async function doRestoreSession(): Promise<void> {
  const { tokens, setTokens } = useAuthStore.getState();
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error('Not authenticated');
  }

  // 이미 Supabase 클라이언트에 세션이 있으면 스킵
  const { data: { session: existing } } = await supabase!.auth.getSession();
  if (existing) {
    sessionRestored = true;
    return;
  }

  // 세션 복원
  const { data, error } = await supabase!.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  if (error) {
    console.error('[EdgeFunctionClient] setSession failed:', error.message);
    throw new Error('Session restore failed: ' + error.message);
  }

  // 갱신된 토큰을 authStore에 반영
  if (data.session) {
    setTokens({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
        ? data.session.expires_at * 1000
        : Date.now() + 3600_000,
    });
  }

  sessionRestored = true;
}

/** 세션 무효화 (로그아웃 또는 401 재시도 시) */
export function invalidateSession(): void {
  sessionRestored = false;
}

export async function callEdgeFunction<T = unknown>(
  functionName: string,
  options: CallOptions = {}
): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');

  await ensureSession();

  // arraybuffer 응답 시 raw fetch 사용 (응답 헤더 보존)
  if (options.responseType === 'arraybuffer') {
    return callEdgeFunctionRaw<T>(functionName, options);
  }

  // query params가 있으면 function name에 붙임
  let fnPath = functionName;
  if (options.params && Object.keys(options.params).length > 0) {
    const qs = new URLSearchParams(options.params).toString();
    fnPath = `${functionName}?${qs}`;
  }

  type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  const method = (options.method || (options.body ? 'POST' : 'GET')) as HttpMethod;

  const invokeOptions: {
    method: HttpMethod;
    body?: string;
    headers?: Record<string, string>;
  } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (options.body) {
    invokeOptions.body = JSON.stringify(options.body);
  }

  const { data, error } = await supabase.functions.invoke(fnPath, invokeOptions);

  if (error) {
    const message = error.message || 'Edge function error';

    // 401 시 세션 무효화 후 1회 재시도
    if (message.includes('Invalid JWT') || message.includes('Unauthorized')) {
      console.warn('[EdgeFunctionClient] Auth error, invalidating session and retrying');
      invalidateSession();
      await ensureSession();

      const retry = await supabase.functions.invoke(fnPath, invokeOptions);
      if (retry.error) {
        throw new EdgeFunctionError(
          'Unauthorized',
          retry.error.message,
          401,
          new Headers(),
          {}
        );
      }
      return retry.data as T;
    }

    // 에러 body 파싱 시도. Supabase JS가 non-2xx 응답을 error.context(Response)에 담아
    // 보낼 수 있어서 거기서 body를 읽어 진단 메시지를 보존한다.
    let errorBody: Record<string, unknown> = {};
    if (typeof data === 'string') {
      try { errorBody = JSON.parse(data); } catch { /* ignore */ }
    } else if (data && typeof data === 'object') {
      errorBody = data as Record<string, unknown>;
    }
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.text === 'function') {
      try {
        const text = await ctx.clone().text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          errorBody = { ...errorBody, ...parsed };
        }
      } catch { /* body가 비거나 JSON 아니면 무시 */ }
    }

    const status = (error as unknown as { status?: number }).status || 500;

    // quota_exceeded → QuotaExceededError
    if (errorBody.error === 'quota_exceeded' || status === 429) {
      throw new QuotaExceededError(errorBody, new Headers());
    }

    throw new EdgeFunctionError(
      (errorBody.error as string) || 'server_error',
      (errorBody.message as string) || message,
      status,
      new Headers(),
      errorBody
    );
  }

  return data as T;
}

/**
 * raw fetch()를 사용하여 Edge Function 호출 — arraybuffer 응답 + 헤더 보존
 */
async function callEdgeFunctionRaw<T>(
  functionName: string,
  options: CallOptions,
  isRetry = false,
): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase not configured');

  const { data: { session } } = await supabase!.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  let url = `${supabaseUrl}/functions/v1/${functionName}`;
  if (options.params && Object.keys(options.params).length > 0) {
    url += '?' + new URLSearchParams(options.params).toString();
  }

  const method = options.method || (options.body ? 'POST' : 'GET');
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    // 401 시 세션 무효화 후 1회 재시도
    if (response.status === 401 && !isRetry) {
      console.warn('[EdgeFunctionClient] Raw fetch 401, invalidating session and retrying');
      invalidateSession();
      await ensureSession();
      return callEdgeFunctionRaw<T>(functionName, options, true);
    }

    // 에러 body 파싱
    let errorBody: Record<string, unknown> = {};
    try {
      const text = await response.text();
      errorBody = JSON.parse(text);
    } catch { /* ignore */ }

    // quota_exceeded → QuotaExceededError
    if (errorBody.error === 'quota_exceeded' || response.status === 429) {
      throw new QuotaExceededError(errorBody, response.headers);
    }

    throw new EdgeFunctionError(
      (errorBody.error as string) || 'server_error',
      (errorBody.message as string) || response.statusText,
      response.status,
      response.headers,
      errorBody
    );
  }

  const buf = await response.arrayBuffer();
  return { data: buf, headers: response.headers } as T;
}

export class EdgeFunctionError extends Error {
  constructor(
    public readonly code: string,
    public readonly detail: string,
    public readonly status: number,
    public readonly headers: Headers,
    public readonly body?: Record<string, unknown>
  ) {
    super(`${code}: ${detail}`);
    this.name = 'EdgeFunctionError';
  }
}

export class QuotaExceededError extends EdgeFunctionError {
  public readonly used: number;
  public readonly limit: number;
  public readonly plan: string;

  constructor(body: Record<string, unknown>, headers: Headers) {
    super('quota_exceeded', body.message as string || 'Monthly credit limit exceeded', 429, headers, body);
    this.name = 'QuotaExceededError';
    this.used = (body.used as number) || 0;
    this.limit = (body.limit as number) || 0;
    this.plan = (body.plan as string) || 'free';
  }
}
