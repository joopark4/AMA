# #012 Edge Function JWT 인증 실패

## 상태: 해결됨 (2026-02-28)

## 증상

Edge Function 호출 시 다음 에러가 연속 발생:

1. `Invalid JWT` — Supabase 게이트웨이에서 함수 코드 실행 전 거부
2. `Invalid Refresh Token: Already Used` — refresh token이 이중 소비되어 세션 복원 실패
3. `Failed to send a request to the Edge Function` — CORS preflight 실패로 요청 자체가 전송되지 않음

## 환경

- Supabase 클라이언트: `persistSession: false` (Tauri 앱에서 localStorage 사용 불가)
- React StrictMode: 개발 모드에서 컴포넌트 이중 마운트
- Edge Function: Supabase Deno 런타임

## 원인 분석

3가지 원인이 복합적으로 작용:

### 1. CORS 헤더 누락

`supabase.functions.invoke()`는 요청 시 `apikey` 헤더를 자동 전송합니다. 그러나 Edge Function의 CORS 설정에서 `Access-Control-Allow-Headers`에 `apikey`가 포함되지 않아 브라우저 preflight(OPTIONS) 요청이 실패했습니다.

```typescript
// 기존 (문제) — apikey 누락
'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info'

// 수정 후
'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey'
```

### 2. Refresh Token 이중 소비

React StrictMode에서 컴포넌트가 2회 마운트되면서 `checkPremiumStatus()`가 동시에 2회 호출되었습니다:

```
1차 호출 → setSession(refresh_token_A) → Supabase가 refresh_token_A 소비 → 새 토큰 발급
2차 호출 → setSession(refresh_token_A) → 이미 소비됨 → "Already Used" 에러
```

Supabase의 refresh token은 일회용(one-time use)이므로, 첫 번째 `setSession()` 호출이 토큰을 소비하면 동시에 실행된 두 번째 호출은 반드시 실패합니다.

### 3. 게이트웨이 JWT 검증

Supabase Edge Function 게이트웨이는 함수 코드가 실행되기 전에 JWT를 검증합니다. 만료된 토큰이나 유효하지 않은 토큰은 함수 내부의 인증 로직(`getUser()` 등)에 도달하기 전에 게이트웨이 레벨에서 거부됩니다.

이로 인해 함수 내부에서 자체적으로 토큰을 검증하는 로직이 있더라도, 게이트웨이를 통과하지 못하면 무의미합니다.

## 해결

### 1. CORS 헤더에 `apikey` 추가

모든 Edge Function의 CORS 응답 헤더에 `apikey`를 추가:

```typescript
// supabase/functions/*/index.ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
```

### 2. `--no-verify-jwt`로 Edge Function 재배포

게이트웨이의 사전 JWT 검증을 비활성화하고, 함수 내부에서 `getUser()`로 직접 인증을 수행하도록 변경:

```bash
supabase functions deploy <function-name> --no-verify-jwt --project-ref <ref>
```

함수 내부에서 직접 인증:

```typescript
const { data: { user }, error } = await supabaseClient.auth.getUser(jwt);
if (error || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: corsHeaders,
  });
}
```

### 3. `checkingPromise` 싱글턴 패턴으로 이중 호출 방지

`premiumStore.ts`에서 `checkPremiumStatus()`의 이중 호출을 방지:

```typescript
/** checkPremiumStatus 이중 호출 방지 (React StrictMode) */
let checkingPromise: Promise<void> | null = null;

checkPremiumStatus: async () => {
  // 이미 실행 중이면 기존 Promise 재사용
  if (checkingPromise) return checkingPromise;
  checkingPromise = (async () => {
    // ... 실제 로직
  })();
  try {
    await checkingPromise;
  } finally {
    checkingPromise = null;
  }
},
```

### 4. `edgeFunctionClient.ts`에서 세션 복원 싱글턴

`ensureSession()`을 싱글턴 패턴으로 구현하여 동시 호출 시 세션 복원이 한 번만 실행되도록 보장. `getSession()` 우선 확인으로 불필요한 `setSession()` 호출을 방지:

```typescript
let restorePromise: Promise<void> | null = null;
let sessionRestored = false;

async function ensureSession(): Promise<void> {
  if (sessionRestored) return;
  if (restorePromise) return restorePromise;

  restorePromise = doRestoreSession();
  try {
    await restorePromise;
  } finally {
    restorePromise = null;
  }
}

async function doRestoreSession(): Promise<void> {
  // getSession()으로 기존 세션 확인 → 있으면 스킵
  const { data: { session: existing } } = await supabase!.auth.getSession();
  if (existing) {
    sessionRestored = true;
    return;
  }
  // 없을 때만 setSession() 실행
  // ...
}
```

## 교훈

1. **Supabase `persistSession: false` 환경**: 세션 복원 시 refresh token 일회성을 반드시 고려해야 함
2. **React StrictMode**: 부수 효과가 있는 비동기 호출은 반드시 중복 실행 방지 패턴 적용
3. **Edge Function CORS**: `supabase.functions.invoke()`가 전송하는 모든 헤더를 `Allow-Headers`에 포함해야 함
4. **JWT 검증 전략**: 게이트웨이 검증(`--verify-jwt`)은 토큰 만료 시 함수 코드에 도달 불가 — 유연한 인증이 필요하면 `--no-verify-jwt` + 함수 내부 검증 사용

## 관련 파일

- `src/services/auth/edgeFunctionClient.ts` — 세션 복원 싱글턴 + 401 재시도
- `src/stores/premiumStore.ts` — `checkPremiumStatus` 이중 호출 방지
- `supabase/functions/*/index.ts` — CORS 헤더 + 내부 JWT 검증
