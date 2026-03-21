# #015 프리미엄 TTS가 기본 음성으로 폴백되는 문제

## 상태: 해결됨 (2026-03-21)

## 증상

설정에서 프리미엄 음성(Supertone API)을 선택했지만, 실제 TTS 출력은 로컬 Supertonic(F1)으로 재생됨.

## 원인 (3가지 복합)

### 1. VoiceSettings useEffect가 엔진을 강제 리셋

**위치:** `src/components/settings/VoiceSettings.tsx`

```typescript
// 기존 코드 (문제)
useEffect(() => {
  if (settings.tts.engine !== 'supertonic' || !SUPERTONIC_VOICE_KEYS.includes(settings.tts.voice || '')) {
    setTTSSettings({ engine: 'supertonic', voice: 'F1' });
  }
}, []);
```

설정 패널을 열 때마다 `VoiceSettings`가 마운트되면서 `engine`이 `supertonic`이 아니면 **강제로 `supertonic`으로 리셋**. 프리미엄 TTS 추가 이전에 작성된 레거시 코드.

**수정:**
```typescript
// supertone_api 사용 중이면 건드리지 않음
if (settings.tts.engine === 'supertonic' && !SUPERTONIC_VOICE_KEYS.includes(settings.tts.voice || '')) {
  setTTSSettings({ voice: 'F1' });
}
```

### 2. Edge Function `--no-verify-jwt` 누락

**위치:** Edge Function 배포 명령

`supabase functions deploy supertone-tts` 실행 시 `--no-verify-jwt` 플래그를 빠뜨리면, Supabase 게이트웨이가 JWT를 사전 검증하여 `Invalid JWT` (401)을 반환. 함수 코드에 도달하기 전에 거부됨.

이슈 #012에서 이미 해결된 문제가 Edge Function 재배포 시 재발.

**수정:** 배포 시 항상 `--no-verify-jwt` 사용
```bash
supabase functions deploy supertone-tts --no-verify-jwt --project-ref <ref>
```

### 3. 관리자 할당량 우회 미구현

**위치:** `supabase/functions/supertone-tts/index.ts`

관리자(`is_admin = true`) 계정도 일반 사용자와 동일한 할당량 제한을 받아 `quota_exceeded` (429) 발생.

**수정:** Edge Function에서 `is_admin` 체크 추가
```typescript
const { data: profile } = await supabaseUser
  .from('profiles')
  .select('plan_id, monthly_credit_limit_override, is_premium, is_admin')
  .eq('id', user.id)
  .single();

const isAdmin = profile?.is_admin === true;

if (!isAdmin && !profile?.is_premium) { /* 403 */ }
if (!isAdmin && usedCredits >= creditLimit) { /* 429 */ }
```

## 디버깅 과정

1. `ttsRouter.ts`에 `console.log`로 엔진 선택 로그 추가 → `engine: supertone_api` 확인
2. `[SupertoneAPI] Synthesizing chunk` 로그 후 `[Supertonic] Synthesizing` 출현 → API 호출 실패 후 로컬 폴백 확인
3. 에러: `QuotaExceededError: quota_exceeded` → 할당량 문제
4. DB 확인: `usedCredits=62, creditLimit=999999` → 할당량 충분
5. Edge Function 재배포 후: `Invalid JWT` (401) → `--no-verify-jwt` 누락 발견
6. `--no-verify-jwt`로 재배포 후에도 401 → 관리자 우회 추가 + 재배포로 해결
7. localStorage 직접 확인 (SQLite): `engine: "supertonic"` → VoiceSettings useEffect 리셋 발견

## 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/settings/VoiceSettings.tsx` | useEffect 엔진 리셋 조건 수정 |
| `src/components/settings/VoiceSettings.tsx` | TTS 상태 표시 (Supertonic 녹색 / Supertone API 보라색) |
| `supabase/functions/supertone-tts/index.ts` | `is_admin` 체크 추가 (관리자 프리미엄/할당량 우회) |

## 교훈

1. **레거시 코드 주의**: 새 기능(프리미엄 TTS) 추가 후 기존 정규화 코드가 새 설정을 덮어쓸 수 있음
2. **Edge Function 배포 플래그**: `--no-verify-jwt`는 이슈 #012에서 결정된 필수 플래그. 배포 스크립트에 고정 필요
3. **localStorage 디버깅**: Tauri WebView의 localStorage는 `~/Library/WebKit/com.mypartnerai/` 하위 SQLite에 저장됨. dev/production origin이 다르므로 올바른 DB 파일을 확인해야 함
4. **관리자 계정 우회**: 서버 측 Edge Function에서도 관리자 권한을 확인하여 불필요한 제한을 건너뛰어야 함

## 관련 이슈

- [#012 Edge Function JWT 인증 실패](./012-edge-function-jwt-auth.md)
- [#014 개발 모드 OAuth 콜백 + 세션 복원 안정화](./014-dev-oauth-and-session-restore.md)
