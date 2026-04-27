# DB 스키마

> Supabase PostgreSQL 기반. `supabase/migrations/` 참조.

---

## 테이블 구조

```
auth.users (Supabase 자동 관리)
  ├─ public.profiles              (1:1)  프로필 + 구독 정보
  ├─ public.user_settings         (1:1)  앱 설정
  ├─ public.user_consents         (1:N)  약관 동의 이력
  ├─ public.tts_usage             (1:N)  TTS 사용량 추적
  └─ public.subscription_history  (1:N)  구독 변경 이력

public.subscription_plans         (독립)  구독 플랜 정의
```

---

## `public.profiles`

신규 가입 시 트리거로 자동 생성. 별도 INSERT 불필요.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | `auth.users.id` 참조 |
| `nickname` | TEXT | full_name → user_name → email → '사용자' 순으로 폴백 |
| `avatar_url` | TEXT | OAuth 프로필 이미지 URL |
| `provider` | TEXT | `google` / `apple` / `facebook` / `twitter` |
| `is_premium` | BOOLEAN | 프리미엄 구독 여부 (기본: FALSE) |
| `plan_id` | TEXT FK | 구독 플랜 ID (`subscription_plans.id` 참조, 기본: `free`) |
| `monthly_credit_limit_override` | NUMERIC | 플랜 한도 오버라이드 (NULL이면 플랜 기본값) |
| `is_admin` | BOOLEAN | 관리자 여부 (기본: FALSE) |
| `plan_changed_at` | TIMESTAMPTZ | 플랜 변경 시각 |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**트리거:** `on_auth_user_created` — `auth.users` INSERT 후 자동 실행

---

## `public.user_settings`

앱 설정을 클라우드에 동기화. **API 키는 저장하지 않음** (로컬 only).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `user_id` | UUID | `auth.users.id` 참조, UNIQUE |
| `language` | TEXT | `ko` / `en` |
| `avatar_name` | TEXT | 아바타 이름 |
| `llm_provider` | TEXT | 선택한 LLM 제공자 |
| `settings` | JSONB | apiKey 제외한 기타 설정 |
| `schema_version` | INT | 마이그레이션 버전 (현재 7) |
| `updated_at` | TIMESTAMPTZ | |

---

## `public.user_consents`

약관 동의 이력. 버전별로 동의 시각을 기록.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `user_id` | UUID | `auth.users.id` 참조 |
| `terms_type` | TEXT | `terms` (이용약관) / `privacy` (개인정보처리방침) |
| `terms_ver` | TEXT | 약관 버전 (예: `2026.02`) |
| `agreed` | BOOLEAN | 동의 여부 (기본 TRUE) |
| `agreed_at` | TIMESTAMPTZ | 동의 시각 |

UNIQUE 제약: `(user_id, terms_type, terms_ver)`

---

## `public.subscription_plans`

구독 플랜 정의. 앱 초기화 시 기본 플랜 3개가 시드됨.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | TEXT PK | 플랜 ID (`free`, `basic`, `pro`) |
| `name` | TEXT | 표시 이름 |
| `monthly_credit_limit` | NUMERIC | 월간 크레딧 한도 |
| `description` | TEXT | 플랜 설명 |
| `features` | JSONB | 기능 목록 (기본: `[]`) |
| `sort_order` | INT | 정렬 순서 |
| `is_active` | BOOLEAN | 활성 여부 (기본: TRUE) |
| `created_at` | TIMESTAMPTZ | |

**기본 플랜:**

| ID | 이름 | 월간 크레딧 | 비고 |
|----|------|-----------|------|
| `free` | Free | 0 | 로컬 TTS만 사용 |
| `basic` | Basic | 300 | 월 5분 |
| `pro` | Pro | 1200 | 월 20분 |

---

## `public.tts_usage`

TTS API 사용량 추적. 매 요청마다 기록.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `user_id` | UUID FK | `auth.users.id` 참조 (CASCADE) |
| `voice_id` | TEXT | Supertone 음성 ID |
| `voice_name` | TEXT | 음성 이름 |
| `model` | TEXT | TTS 모델 (`sona_speech_1` 등) |
| `language` | TEXT | 출력 언어 |
| `style` | TEXT | 스타일 (`neutral`, `happy` 등) |
| `text_length` | INT | 입력 텍스트 길이 |
| `audio_duration` | NUMERIC | 생성된 오디오 길이 (초) |
| `credits_used` | NUMERIC | 소비 크레딧 (1초 = 1크레딧) |
| `created_at` | TIMESTAMPTZ | |

**인덱스:** `idx_tts_usage_user_date` — `(user_id, created_at DESC)`

---

## `public.subscription_history`

구독 변경 이력. 플랜 변경 시 기록.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | |
| `user_id` | UUID FK | `auth.users.id` 참조 (CASCADE) |
| `old_plan_id` | TEXT FK | 이전 플랜 |
| `new_plan_id` | TEXT FK | 변경된 플랜 |
| `changed_by` | UUID FK | 변경 실행자 (관리자 or 본인) |
| `reason` | TEXT | 변경 사유 |
| `created_at` | TIMESTAMPTZ | |

---

## RLS 정책

모든 테이블에 Row Level Security 활성화. 본인 데이터만 접근 가능.

| 테이블 | 정책 | 조건 |
|--------|------|------|
| `profiles` | SELECT, UPDATE | `auth.uid() = id` 또는 `is_admin()` |
| `user_settings` | ALL | `auth.uid() = user_id` |
| `user_consents` | ALL | `auth.uid() = user_id` |
| `subscription_plans` | SELECT | 모든 사용자 (공개) |
| `tts_usage` | SELECT | `auth.uid() = user_id` 또는 `is_admin()` |
| `tts_usage` | INSERT | `auth.uid() = user_id` |
| `subscription_history` | SELECT | `auth.uid() = user_id` 또는 `is_admin()` |
| `subscription_history` | INSERT | `is_admin()` 또는 본인 |

**Admin 체크 함수:** `public.is_admin()` — `SECURITY DEFINER`로 RLS 무한 재귀 방지

---

## 데이터 저장 정책

| 데이터 | 저장 위치 | 탈퇴 시 처리 |
|--------|----------|------------|
| 프로필 (nickname, avatar_url) | Supabase 클라우드 | CASCADE 즉시 삭제 |
| 앱 설정 (apiKey 제외) | Supabase 클라우드 | CASCADE 즉시 삭제 |
| 약관 동의 이력 | Supabase 클라우드 | CASCADE 즉시 삭제 |
| TTS 사용량 | Supabase 클라우드 | CASCADE 즉시 삭제 |
| 구독 변경 이력 | Supabase 클라우드 | CASCADE 즉시 삭제 |
| 대화 기록 | 로컬 only | 탈퇴 시 앱에서 직접 삭제 |
| API 키 | 로컬 only | 탈퇴 시 앱에서 직접 삭제 |
| 인증 토큰 | 로컬 only | 탈퇴 시 앱에서 직접 삭제 |

---

## 마이그레이션 적용 상태

> **현재 원격 DB 상태 (2026-02-28 기준): 모두 적용 완료 ✅**
> - 기존 테이블: `profiles`, `user_settings`, `user_consents`
> - 신규 테이블: `subscription_plans`, `tts_usage`, `subscription_history`
> - `profiles` 확장 컬럼: `is_premium`, `plan_id`, `monthly_credit_limit_override`, `is_admin`, `plan_changed_at`
> - `on_auth_user_created` 트리거 존재 확인
> - `public.is_admin()` 함수 생성 확인
> - RLS 정책 적용 확인

### 신규 환경 적용 방법

```bash
# Supabase CLI 사용
export SUPABASE_ACCESS_TOKEN=<personal-access-token>  # supabase.com/dashboard/account/tokens
supabase link --project-ref <project-ref>
supabase db push

# 또는 Supabase SQL Editor에서 직접 실행
# supabase/migrations/001_initial_schema.sql
# supabase/migrations/20260228000000_premium_feature.sql
```

> 로컬 Docker 없이도 `SUPABASE_ACCESS_TOKEN`으로 원격 DB에 직접 push 가능.
