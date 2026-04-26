# AMA 디자인 핸드오프 패키지

> `joopark4/MyPartnerAI` 레포에 이 디자인을 구현하기 위한 개발자 가이드  
> Version 1.0 · 2026-04

## 📦 포함된 문서

| 파일 | 용도 |
|---|---|
| [`01-overview.md`](./01-overview.md) | 전체 개요, 디자인 철학, 변경 범위 |
| [`02-design-tokens.md`](./02-design-tokens.md) | 색상·타이포·spacing·애니메이션 토큰 |
| [`03-file-mapping.md`](./03-file-mapping.md) | 프로토타입 파일 → 실제 레포 파일 매핑표 |
| [`04-components.md`](./04-components.md) | 컴포넌트별 상세 사양 (props, 상태, 인터랙션) |
| [`05-new-features.md`](./05-new-features.md) | 신규 기능 구현 가이드 (자주 쓰는 기능, 아바타 숨기기, 텍스트 입력 토글) |
| [`06-implementation-plan.md`](./06-implementation-plan.md) | 단계별 구현 로드맵 (PR 쪼개기) |
| [`screens/`](./screens/) | 화면별 참고 스크린샷 |

## 🎯 핸드오프 대상

- **1차**: 레포 오너 (joopark4) — 설계 의도 이해 + 우선순위 결정
- **2차**: Claude Code / AI 에이전트 — 실제 구현 작업
- **3차**: 외부 기여자 — 디자인 일관성 유지

## 🚀 빠른 시작 (Claude Code에게 주는 프롬프트 예시)

```
@handoff/01-overview.md @handoff/02-design-tokens.md @handoff/03-file-mapping.md 
@handoff/04-components.md @handoff/05-new-features.md 
@handoff/06-implementation-plan.md

위 문서를 읽고, 06-implementation-plan.md의 Phase 1 (디자인 토큰 + 오버레이 
컨트롤 클러스터)부터 구현해줘. 기존 기능은 유지하고, UI만 새 디자인으로 
교체해. 각 단계가 끝나면 커밋하고 다음으로 넘어가.
```

## 📐 디자인 원칙 요약

1. **음성 중심 (Voice-first)** — 키보드 입력은 토글 UI로 필요할 때만 표시
2. **글래시 / 따뜻한 (Warm + Glassy)** — frosted glass + 오렌지/피치 톤 액센트
3. **존재감 중심 아바타** — 발광 오라로 상태 표현, VRM은 자연스럽게 녹아듦
4. **사용자 커스터마이징** — 자주 쓰는 기능 등록, 아바타 이름/크기 직접 설정

## 🔗 원본 프로토타입

- **파일**: `../AMA Prototype.html` (프로젝트 루트)
- **소스**: `../src/*.jsx`
- **실행**: 브라우저에서 HTML 파일 열기
