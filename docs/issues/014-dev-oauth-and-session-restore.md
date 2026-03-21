# #014 개발 모드 OAuth 콜백 + 세션 복원 안정화

## 상태: 해결됨

## 문제 요약

Supertone API 통합 작업 중 다음 3가지 문제가 동시에 발생:

1. **개발 모드 OAuth 딥링크 미동작**: `tauri dev`에서 `mypartnerai://auth/callback` 딥링크가 안정적으로 작동하지 않아 로그인 불가
2. **Supabase refresh token 소진**: HMR(Hot Module Replacement) 사이클마다 `setSession()` 반복 호출로 refresh token이 "Already Used" 상태가 됨
3. **설정 패널이 OAuth 브라우저를 가림**: 설정 패널이 열린 상태에서 OAuth 시작 시 브라우저 선택 UI가 패널 뒤에 숨김

## 근본 원인

### 1. 개발 모드 딥링크 한계

`tauri dev`는 빌드 캐시 디렉토리(`~/Library/Caches/mypartnerai-build/debug/`)에서 실행되므로, URL 스킴 등록이 프로덕션과 다르게 동작한다. 브라우저에서 `mypartnerai://auth/callback?code=XXX`를 열어도 Tauri 앱에 전달되지 않는 경우가 발생.

### 2. Refresh Token 소진 메커니즘

```
HMR 발생 → premiumStore 모듈 재평가 → checkPremiumStatus() 호출
→ supabase.auth.setSession() 호출 → refresh token 소비 + 새 토큰 발급
→ HMR이 새 토큰 저장 전에 모듈을 다시 평가
→ 이전(이미 소비된) refresh token으로 다시 setSession() 시도
→ "Invalid Refresh Token: Already Used" 에러
```

### 3. 설정 패널 Z-index

OAuth 버튼이 설정 패널 내부에 있으므로, `open_oauth_url` 호출 후 설정 패널이 여전히 최상위에 표시되어 브라우저 선택 다이얼로그를 가림.

## 해결 방법

### 1. 개발 모드 Vite OAuth 미들웨어

`vite.config.ts`에 `devOAuthCallbackPlugin` 추가:

```typescript
// apply: 'serve' — dev 서버에서만 동작
function devOAuthCallbackPlugin(): Plugin {
  let pendingCode: string | null = null;
  return {
    name: 'dev-oauth-callback',
    apply: 'serve',
    configureServer(server) {
      // 1. /auth/callback — 브라우저 리다이렉트 수신, code 저장
      server.middlewares.use('/auth/callback', ...);
      // 2. /api/auth-code — 앱에서 1초 간격 폴링으로 code 획득
      server.middlewares.use('/api/auth-code', ...);
    },
  };
}
```

`authService.ts`에서 개발 모드 리다이렉트 URL 분기:

```typescript
const redirectTo = import.meta.env.DEV
  ? 'http://localhost:1420/auth/callback'
  : 'mypartnerai://auth/callback';
```

`UserProfile.tsx`에서 개발 모드 폴링:

```typescript
if (import.meta.env.DEV) {
  oauthPollRef.current = setInterval(async () => {
    const res = await fetch('/api/auth-code');
    const data = await res.json();
    if (data.code) { /* handleCallback → 로그인 완료 */ }
  }, 1000);
}
```

### 2. 세션 복원 안정화 (premiumStore)

`setSession()` 호출 전 기존 세션 존재 여부 확인:

```typescript
const { data: { session: existingSession } } = await supabase.auth.getSession();
if (!existingSession && tokens?.accessToken && tokens?.refreshToken) {
  // 기존 세션 없을 때만 setSession 호출
  const { data: sessionData, error } = await supabase.auth.setSession({...});
  // 새 토큰 즉시 authStore에 저장 (HMR 전 persist)
  if (sessionData?.session) {
    useAuthStore.getState().setTokens({...});
  }
  // Invalid Refresh Token 시 로그아웃 처리
  if (error?.message.includes('Invalid Refresh Token')) {
    useAuthStore.getState().logout();
    return;
  }
}
```

### 3. OAuth 시작 시 설정 패널 닫기

```typescript
// UserProfile.tsx handleOAuthLogin
useSettingsStore.getState().closeSettings();
await invoke('open_oauth_url', { url: authUrl });
```

## 수정 파일

| 파일 | 변경 |
|------|------|
| `vite.config.ts` | `devOAuthCallbackPlugin` 미들웨어 추가 |
| `src/services/auth/authService.ts` | 개발 모드 redirectTo를 localhost로 분기 |
| `src/components/auth/UserProfile.tsx` | 개발 모드 폴링 + 설정 패널 닫기 + 타이머 정리 |
| `src/stores/premiumStore.ts` | `getSession()` 선확인 + refresh token 만료 처리 |

## 교훈

1. **Supabase `setSession()` 주의**: refresh token은 일회성이므로 반복 호출 금지. 반드시 `getSession()`으로 기존 세션 확인 후 호출.
2. **HMR과 외부 상태**: HMR이 모듈을 재평가할 때 Supabase 같은 외부 서비스의 일회성 토큰이 소진될 수 있다. persist 저장을 setSession 직후에 수행하여 토큰 유실 방지.
3. **개발/프로덕션 OAuth 경로 분리**: `tauri dev`에서 딥링크는 불안정하므로 개발 전용 localhost 콜백 경로 제공.
4. **에이전트 팀 작업 시 범위 관리**: 멀티 에이전트 작업 시 각 에이전트의 수정 범위를 명확히 제한하고, 소스 코드 변경은 코드 전담 에이전트만 수행하도록 역할 분리 필요.
