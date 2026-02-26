# Issue #009: 클라우드 LLM 모델 목록 자동 동기화 적용

> 작성일: 2026-02-17

## 문제 요약

설정 화면의 클라우드 모델 목록이 고정 후보 중심이라 실제 계정/API 키 기준 사용 가능한 모델과 불일치할 수 있었다.

## 기존 한계

- 모델 드롭다운이 정적 후보 목록 위주로 표시됨
- 키/권한/플랜에 따라 사용 가능한 모델이 달라도 즉시 반영되지 않음
- 일부 모델은 선택 후 요청 시점에서야 실패를 확인 가능

## 해결 내용

`LLMSettings`에 provider별 모델 목록 동기화 로직을 추가했다.

### 1) 목록 조회

- OpenAI: SDK `models.list()`
- Claude: `GET https://api.anthropic.com/v1/models`
- Gemini: `GET https://generativelanguage.googleapis.com/v1beta/models`

### 2) 목록 정리/표시

- 채팅 용도에 맞지 않는 모델 ID 필터링
- Gemini `models/...` prefix 정규화
- 추천 모델 우선 정렬 + 조회 결과 병합
- 현재 선택 모델이 사용 가능 목록에 없으면 자동으로 사용 가능한 첫 모델로 전환

### 3) 폴백

목록 API 실패 시 기본 후보 모델들에 대해 최소 요청으로 사용 가능 여부를 점검하는 기존 방식으로 자동 전환.

## 검증

- `npx tsc --noEmit` 통과
- `npx eslint src/components/settings/LLMSettings.tsx` 통과
- Provider/API Key 변경 시 모델 목록 및 상태 라벨 갱신 확인

## 변경 파일

- `src/components/settings/LLMSettings.tsx`
- `docs/ai-services.md`
