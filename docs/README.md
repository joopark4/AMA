# 문서 목차

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [auth-supabase.md](./auth-supabase.md) | Supabase OAuth 연동, 환경변수, 트러블슈팅 | 2026.02 |
| [db-schema.md](./db-schema.md) | DB 테이블 구조, RLS 정책, 데이터 저장 정책 | 2026.02 |
| [member-management.md](./member-management.md) | 가입 흐름, 약관 동의, 계정 탈퇴, Edge Function | 2026.02 |

---

## 작업 이력

### 2026.02 — Supabase OAuth + 회원 관리 기반 구축

- Supabase OAuth 연동 완료 (Google)
- DB 스키마 설계 및 적용: `profiles`, `user_settings`, `user_consents` + RLS
- Edge Function `delete-account` 배포
- 약관 동의 UI (이용약관 + 개인정보처리방침 체크박스, 모달)
- 계정 탈퇴 UI (2단계 확인, 클라우드 + 로컬 전체 삭제)
- `ENABLED_PROVIDERS` 상수로 provider 활성화 중앙 관리
- 대화 기록 500개 제한 제거 → 무제한 로컬 저장
- Supabase CLI 설치, Docker 외장 드라이브 마운트 설정
