# DB 스키마

> Supabase PostgreSQL 기반. `supabase/migrations/001_initial_schema.sql` 참조.

---

## 테이블 구조

```
auth.users (Supabase 자동 관리)
  ├─ public.profiles        (1:1)  프로필
  ├─ public.user_settings   (1:1)  앱 설정
  └─ public.user_consents   (1:N)  약관 동의 이력
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

## RLS 정책

모든 테이블에 Row Level Security 활성화. 본인 데이터만 접근 가능.

| 테이블 | 정책 | 조건 |
|--------|------|------|
| `profiles` | SELECT, UPDATE | `auth.uid() = id` |
| `user_settings` | ALL | `auth.uid() = user_id` |
| `user_consents` | ALL | `auth.uid() = user_id` |

---

## 데이터 저장 정책

| 데이터 | 저장 위치 | 탈퇴 시 처리 |
|--------|----------|------------|
| 프로필 (nickname, avatar_url) | Supabase 클라우드 | CASCADE 즉시 삭제 |
| 앱 설정 (apiKey 제외) | Supabase 클라우드 | CASCADE 즉시 삭제 |
| 약관 동의 이력 | Supabase 클라우드 | CASCADE 즉시 삭제 |
| 대화 기록 | 로컬 only | 탈퇴 시 앱에서 직접 삭제 |
| API 키 | 로컬 only | 탈퇴 시 앱에서 직접 삭제 |
| 인증 토큰 | 로컬 only | 탈퇴 시 앱에서 직접 삭제 |

---

## 마이그레이션 적용 방법

```bash
# Supabase CLI (외장 드라이브 Docker 마운트 필요)
supabase link --project-ref <project-ref>
supabase db push

# 또는 Supabase SQL Editor에서 직접 실행
# supabase/migrations/001_initial_schema.sql
```
