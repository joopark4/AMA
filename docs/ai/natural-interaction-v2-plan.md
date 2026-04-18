# 자연 상호작용 v2 — 개선 플랜

> 작성일: 2026-04-18
> 브랜치: `natural-interaction`
> 선행 작업: Phase 0~5 (`docs/ai/natural-interaction-plan.md`) 완료 전제

## 배경

Phase 0~5가 **구조/프롬프트** 축에서 자연 상호작용의 기반을 놓았으나, 실제 사용 시 "AI 티가 나는" 부분은 **실행 신호(트리거)**와 **렌더링 표현(감정/비언어)** 쪽에 집중되어 있다. v2는 이 두 축을 보강한다.

## 현재 한계 (코드 파악 결과)

| 영역 | 한계 | 관련 파일 |
|------|------|-----------|
| 활동 감지 | `sendMessage` 호출만 활동 신호 → 마우스/키보드/포커스 미추적 | `useConversation.ts`, `proactiveEngine.ts` |
| 트리거 해상도 | 1분 타이머 체크 → 실제 idle 여부 불확실 | `proactiveEngine.ts` |
| 컨텍스트 수집 | 시간/세션 경과만 → 화면/활동 미인식 | `contextCollector.ts` |
| 감정 표현 | 8종 이산값 + score≥2 하드스위칭 → 강도/그라데이션 부재 | `analyzeEmotion.ts`, `conversationStore.ts` |
| 발화 트리거 | 3종 고정(idle/time/return) → 문맥 변형 없음 | `proactiveEngine.ts` |
| 비언어 | 없음 → "듣고 있음"/"보고 있음" 신호 전무 | (미구현) |

## 개선 축 5가지

### 1. Presence 벡터 (활동/현존 감지 고도화)

**핵심**: `sendMessage` 단일 신호 → 저비용 멀티 시그널 presence 벡터(1~5초 샘플링).

**수집 신호**:
- Rust/macOS: `CGEventSource::secondsSinceLastEventType(kCGAnyInputEventType)` — 권한 없이 global idle 초
- Rust/macOS: `NSWorkspace.frontmostApplication` — 활성 앱, 전체화면 여부
- 재활용: 기존 마이크 스트림의 RMS
- 브라우저: `mousemove` 속도, `visibilitychange`, `navigator.getBattery()`

```ts
type Presence = {
  idleSec: number;
  typingRate: number;  // keys/min
  micRms: number;
  frontApp: string;
  isFullscreen: boolean;
  attentionScore: number; // 가중합
};
```

### 2. Inner-Thought 트리거 (능동 발화 설계)

**핵심**: 타이머 대신 이벤트/조건 기반 트리거 + LLM 2-stage 필터.

**트리거 이벤트**: `on_pause` / `on_context_change` / `on_mood_shift` / `on_front_app_change` / `on_fullscreen_exit`

```ts
const signals = {
  idleJumpedOver5min, frontAppChanged, returnFromFullscreen,
  micSpikeWithoutSpeech, timeBoundary, userMoodShift,
};
const urgency = weightedSum(signals, weights);  // 0..1
const cooldown = lastSpokeSec < suppressWindow(urgency);
// suppressWindow: urgency 0.9→2min, 0.5→10min, 0.2→30min
if (urgency > 0.4 && !cooldown) innerThought();
```

2-stage LLM: `should_speak: bool + utterance` → 헛발화 1차 필터.

### 3. 비언어 상호작용 (시선/제스처/반응)

**핵심**: 말하기 전에 **"듣고 있음/보고 있음"** 신호부터. VRM `lookAt` + 블렌드셰이프 + head-nod.

- **Gaze follow**: 커서 위치 → `vrm.lookAt.target` (이미 구조 있음). idle 길면 saccade jitter(±15°, 2~4s) + blink.
- **Backchannel 끄덕임**: 마이크 RMS 스파이크 감지 시 0.3s nod + `happy` 0.2 intensity pulse.
- **Hover 반응**: 아바타 hitbox 위 마우스 >1s → 시선 맞춤 + 눈썹 raise.
- **Breathing layer**: additive 레이어로 항상 재생 유지.

### 4. VAD 연속 감정 모델

**핵심**: 8종 이산 → **VAD(Valence-Arousal-Dominance) 3D 잠재 상태** + lerp 전이. 렌더링 시에만 블렌드셰이프로 매핑.

```ts
type MoodVec = { v: number; a: number; d: number }; // -1..1
// LLM: "sad" → VADcatalog["sad"] = {v:-0.6, a:-0.3, d:-0.2}
// 전이: next = lerp(current, target, alpha=0.15)  // 한 턴에 15%만 이동
// 렌더: nearestBlendshape(current), intensity = clamp(|v|+|a|, 0..1)
```

**효과**: `sad → neutral` 직행 금지, lerp가 자동으로 `pensive` 경유. arousal 축을 weight로 쓰면 약한 기쁨 vs 폭발적 기쁨 구분.

### 5. 카테고리 풀 샘플링 (발화 내용 선택)

**핵심**: 발화를 **카테고리 풀 + 최근-사용 penalty** 샘플링. "말 안 함"도 1급 선택지.

**카테고리**:
- `check_in`, `observation(frontApp)`, `callback(importantFact)`
- `time_ritual`, `mood_mirror`, `playful_tease`
- `silent_gesture` (발화 없이 표정/끄덕만, 비율 30~50%)

반복 회피: 최근 30분 내 category/topic hash penalty, topic embedding cosine > 0.85면 block.

## 우선순위 로드맵

| # | 항목 | 난이도 | 근거 |
|---|------|--------|------|
| **1** | **VAD 연속 감정 + lerp 전이** | **S** | 이산 하드스위칭이 "AI 티" 주범. render lerp 한 줄로 체감 즉시 |
| **2** | **Presence 벡터 + Inner-Thought 트리거** | **M** | "1분 타이머 + idle 5분"이 가장 자주 빗나감. `CGEventSource` + frontApp 신호만 추가해도 트리거 품질 급상승 |
| **3** | **Gaze follow + backchannel nod** | **S~M** | 발화 없이 "살아있다" 인상. `lookAt` 구조 이미 있음 |
| 4 | 카테고리 풀 샘플링 | M | Phase 3 엔진 확장 |
| 5 | Screen Watch 통합 | L | 별도 계획(Screen Watch Plan)과 합류 |

## 구현 순서 (1순위 — VAD 연속 감정)

1. `src/services/character/vadCatalog.ts` 신규 — 8종 이산 emotion → VAD 좌표 매핑 + `nearestEmotion(vec)` 역매핑
2. `conversationStore` — `mood: Emotion` → `mood: { emotion, vec }` 확장, 마이그레이션 포함
3. `useConversation.ts` — 응답 감정 → VAD 타겟 설정, `lerp(current, target, 0.15)` 한 턴 업데이트
4. `VRMAvatar`/`expressionController` — `|v|+|a|` 기반 intensity 연결
5. 시스템 프롬프트 힌트: "현재 기분 벡터" 노출 유지

## 참고 자료

- [Proactive CAs with Inner Thoughts (arXiv 2501.00383)](https://arxiv.org/abs/2501.00383)
- [Full-Duplex-Bench v1.5 (arXiv)](https://arxiv.org/html/2507.23159)
- [VAD Multimodal Emotion Dataset (Nature 2025)](https://www.nature.com/articles/s41597-025-06214-y)
- [Joint Discrete + Dimensional SER (MDPI)](https://www.mdpi.com/2076-3417/15/2/623)
- [tauri-plugin-macos-input-monitor](https://crates.io/crates/tauri-plugin-macos-input-monitor)
- [three-vrm (pixiv)](https://github.com/pixiv/three-vrm)
