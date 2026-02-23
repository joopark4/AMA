# 회원 관리

> 회원 가입 흐름, 약관 동의, 계정 탈퇴 구현 상세.

---

## 회원 가입 흐름

```
AuthScreen.tsx
  └─ 약관 동의 체크박스 (이용약관 + 개인정보처리방침)
       └─ 둘 다 체크 → 로그인 버튼 활성화
            └─ authStore.setHasAgreedToTerms(true) 저장
                 └─ OAuth 로그인 진행
                      └─ Supabase trigger → profiles 자동 생성
```

- `hasAgreedToTerms`는 `mypartnerai-auth` localStorage에 persist
- 이미 동의한 사용자는 재로그인 시 체크박스 건너뜀

---

## 약관 동의 UI

**관련 파일:**
- `src/components/auth/AuthScreen.tsx` — 로그인 화면 체크박스
- `src/components/auth/TermsModal.tsx` — 약관 본문 모달
- `src/stores/authStore.ts` — `hasAgreedToTerms` 상태

**약관 본문:** `src/i18n/ko.json` / `en.json` → `terms.service.sections[]` / `terms.privacy.sections[]`

약관 버전 변경 시 `terms.version` 값을 업데이트 (예: `"2026.02"` → `"2026.06"`).
버전이 바뀌면 `user_consents` 테이블에 새 행이 추가됨.

---

## 계정 탈퇴 흐름

```
UserProfile.tsx (로그인 상태 펼침)
  └─ "계정 삭제" 버튼 클릭 → deleteConfirm = true (경고 표시)
       └─ "영구 삭제" 버튼 클릭
            └─ authService.deleteAccount(accessToken)
                 └─ POST /functions/v1/delete-account (Bearer 토큰)
                      └─ Edge Function: JWT 검증 → Admin.deleteUser()
                           └─ auth.users CASCADE 삭제
                                └─ profiles, user_settings, user_consents 자동 삭제
            └─ conversationStore.clearMessages()  ← 로컬 대화 기록 삭제
            └─ authStore.logout()                 ← 로컬 인증 상태 초기화
```

**관련 파일:**
- `src/components/auth/UserProfile.tsx` — 탈퇴 UI (2단계 확인)
- `src/services/auth/authService.ts` — `deleteAccount()` 메서드
- `src/services/auth/types.ts` — `IAuthService.deleteAccount()` 인터페이스
- `supabase/functions/delete-account/index.ts` — Edge Function

---

## Edge Function: `delete-account`

프론트에서 Supabase Admin API(`deleteUser`)를 직접 호출하면 Service Role Key가 노출됨.
Edge Function을 통해 서버 측에서 안전하게 처리.

**엔드포인트:** `POST /functions/v1/delete-account`
**인증:** `Authorization: Bearer <access_token>`
**동작:**
1. 사용자 JWT 검증 (ANON_KEY로 `getUser()`)
2. Admin API로 `deleteUser(user.id)` 실행 (SERVICE_ROLE_KEY)
3. CASCADE로 모든 관련 데이터 즉시 삭제

**배포:**
```bash
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy delete-account --project-ref <ref>
```

---

## OAuth Provider 활성화 관리

현재 Google만 Supabase에 등록. 추가 provider 등록 시 한 곳만 수정:

```typescript
// src/services/auth/oauthClient.ts
export const ENABLED_PROVIDERS: OAuthProvider[] = ['google'];
// 등록 후: ['google', 'apple', 'meta', 'x']
```

`AuthScreen.tsx`와 `UserProfile.tsx`가 이 상수를 공유하여 UI에 자동 반영.

| Provider | Supabase 등록 | 상태 |
|----------|-------------|------|
| Google | ✅ 완료 | 활성화 |
| Apple | ⏳ 향후 예정 | `ENABLED_PROVIDERS`에서 제외 |
| Meta | ⏳ 향후 예정 | `ENABLED_PROVIDERS`에서 제외 |
| X | ⏳ 향후 예정 | `ENABLED_PROVIDERS`에서 제외 |

---

## 대화 기록 정책

- **저장 위치:** 로컬 only (`mypartnerai-conversation` localStorage)
- **저장 한도:** 무제한 (기존 500개 제한 제거)
- **클라우드 저장:** 없음
- **탈퇴 시:** `clearMessages()` 호출로 로컬 삭제
- **사용자 직접 삭제:** HistoryPanel의 "기록 지우기" 버튼
