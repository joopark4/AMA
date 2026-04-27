# 관리자 계정 관리

## 관리자 권한

`profiles.is_admin = true`인 계정은 다음 권한을 가집니다:

| 항목 | 일반 사용자 | 관리자 |
|------|-----------|--------|
| 프리미엄 TTS | 구독 플랜 필요 | 무제한 사용 |
| 할당량 체크 | 월간 크레딧 제한 | 건너뛰기 |
| RLS 정책 | 본인 데이터만 | 전체 profiles 조회 가능 |

## 관리자 설정 방법

### Supabase Dashboard SQL Editor

```sql
-- 관리자 지정
UPDATE profiles SET
  is_admin = true,
  is_premium = true
WHERE id = '<사용자 UUID>';

-- 확인
SELECT id, email, is_admin, is_premium, plan_id
FROM profiles
WHERE is_admin = true;
```

### Supabase Management API

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/<project-ref>/database/query" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "UPDATE profiles SET is_admin = true, is_premium = true WHERE id = '\''<user-id>'\''"}'
```

## Edge Function 동작

### `supertone-tts`

관리자(`is_admin = true`)인 경우:
- `is_premium` 체크 건너뛰기 (403 미발생)
- 할당량 계산 및 `quota_exceeded` 체크 건너뛰기 (429 미발생)
- TTS 사용량은 기록됨 (`tts_usage` 테이블)

```typescript
// supabase/functions/supertone-tts/index.ts
const isAdmin = profile?.is_admin === true;

if (!isAdmin && !profile?.is_premium) { /* 403 */ }
if (!isAdmin && usedCredits >= creditLimit) { /* 429 */ }
```

### 기타 Edge Function

- `supertone-usage`: 관리자 체크 없음 (사용량 조회만)
- `supertone-voices`: 관리자 체크 없음 (음성 목록만)
- `delete-account`: 관리자 체크 없음 (본인 계정 삭제)

## DB 스키마

```sql
-- profiles 테이블 (관리자 관련 컬럼)
is_admin BOOLEAN NOT NULL DEFAULT FALSE
is_premium BOOLEAN NOT NULL DEFAULT FALSE
plan_id TEXT NOT NULL DEFAULT 'free'
monthly_credit_limit_override NUMERIC  -- NULL이면 플랜 기본값

-- is_admin() 함수 (RLS 정책용, SECURITY DEFINER)
CREATE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER
  AS $$ SELECT COALESCE(...) $$;
```

## 현재 관리자 계정

운영자 정보는 비공개 운영 노트에서 관리합니다. 공개 저장소에는 식별자(이메일·UUID·설정일)를 포함하지 않습니다.

## 주의사항

- `is_admin`은 DB에서만 설정 가능 (앱 UI에서 변경 불가)
- Edge Function 배포 시 반드시 `--no-verify-jwt` 플래그 사용 (이슈 #012 참조)
- 관리자 TTS 사용량도 `tts_usage`에 기록되므로 모니터링 가능
