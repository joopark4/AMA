# Supabase OAuth 연동 가이드

> 관련 문서: [DB 스키마](./db-schema.md) · [회원 관리](./member-management.md)

## 선택 이유

Firebase Auth 대비 Supabase를 선택한 이유:
- Firebase Auth SDK는 `firebaseapp.com` 브라우저 리다이렉트 구조 → Tauri 커스텀 URI 스킴과 직접 호환 불가
- Supabase는 `signInWithOAuth({ skipBrowserRedirect: true })` + `exchangeCodeForSession(code)` 패턴 공식 지원
- `mypartnerai://auth/callback` 딥링크와 자연스럽게 연동

---

## OAuth 흐름

```
UserProfile.tsx
  └─ authService.initiateOAuth(provider)
       └─ supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })
            └─ returns { url } (Supabase가 PKCE 내부 처리)

  └─ invoke('open_oauth_url', { url })   ← Rust: 허용 호스트 검증
       └─ 브라우저 열림 → provider 로그인 → Supabase 콜백

mypartnerai://auth/callback?code=...
  └─ App.tsx onOpenUrl
       └─ invoke('parse_auth_callback', { url })
            └─ authService.handleCallback(code)
                 └─ supabase.auth.exchangeCodeForSession(code)
                      └─ { user, session } → AuthUser + AuthTokens
```

---

## 환경변수 설정

`.env.local` 파일에 추가 (Project Settings → API):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

두 값 모두 없으면 MockAuthService가 동작합니다 (테스트 모드).

---

## Supabase 대시보드 설정 체크리스트

1. [supabase.com](https://supabase.com) → 프로젝트 생성
2. **Authentication → URL Configuration**:
   - Site URL: `mypartnerai://auth`
   - Redirect URLs: `mypartnerai://auth/callback`
3. **Authentication → Providers** — 각 provider 활성화 후 Client ID/Secret 입력

---

## OAuth 콘솔별 리다이렉트 URI 설정

| Provider | 콘솔 | 등록할 리다이렉트 URI |
|---------|------|---------------------|
| Google | console.cloud.google.com | `https://<project>.supabase.co/auth/v1/callback` |
| Apple | developer.apple.com | `https://<project>.supabase.co/auth/v1/callback` |
| Meta | developers.facebook.com | `https://<project>.supabase.co/auth/v1/callback` |
| X (Twitter) | developer.twitter.com | `https://<project>.supabase.co/auth/v1/callback` |

> Supabase 대시보드의 각 provider 설정 화면에서 Client ID와 Secret을 입력합니다.
> X/Twitter는 Supabase에서 `twitter` provider명을 사용합니다 (OAuth 2.0 with PKCE 지원).

---

## 운영 비용 요약

| 플랜 | 월 비용 | MAU 한도 | 주의 |
|------|--------|---------|------|
| **Free** | **무료** | 50,000 | 1주 미접속 시 일시정지 (재접속 시 자동 재개) |
| **Pro** | **$25/월** | 100,000 | 정지 없음, 초과 MAU $0.00325/명 |
| **Team** | $599/월 | 100,000 | 전용 지원 |

개발/초기 운영: Free 플랜 권장. 실 사용자 확보 후 Pro로 업그레이드.

---

## 트러블슈팅

### 콜백 URL이 앱으로 돌아오지 않는 경우
- Supabase 대시보드의 Redirect URLs에 `mypartnerai://auth/callback`이 정확히 등록되어 있는지 확인
- `tauri.conf.json`의 `deepLinkProtocols`에 `mypartnerai` 스킴이 등록되어 있는지 확인

### `허용되지 않은 OAuth 호스트` 오류
- Supabase URL이 `.supabase.co` 도메인인지 확인 (커스텀 도메인 사용 시 `auth.rs`의 `is_allowed_oauth_host` 함수에 추가 필요)

### Mock 모드가 해제되지 않는 경우
- `.env.local`의 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY` 양쪽 모두 설정되어 있는지 확인
- `npm run tauri dev` 재시작 필요 (환경변수 변경 후)

### Free 플랜 프로젝트 정지
- Supabase 대시보드에서 수동으로 프로젝트 재개 가능
- 재개 후 수 분 내 정상화
