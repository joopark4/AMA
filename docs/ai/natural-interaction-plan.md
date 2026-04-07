# Neuro-sama 스타일 자연 상호작용 기능 — 구현 플랜

> 작성일: 2026-04-07
> 상태: Phase 0~5 구현 완료, Phase 6 선택 사항

## 배경

현재 AMA는 사용자가 텍스트/음성 입력 → LLM 응답 → TTS → 감정/모션이라는 **반응형(reactive)** 구조만 갖고 있다. Neuro-sama처럼 자연스러운 상호작용을 하려면 아바타가 **자발적으로(proactive)** 말을 걸고, 대화 맥락을 기억하고, 스트리밍으로 즉각 반응하며, 외부 이벤트(시간/화면/시스템)에 반응하는 능력이 필요하다.

### 기존 성격 시스템의 한계

- `buildSystemPrompt()` (`src/hooks/useConversation.ts`)에 하드코딩된 10줄 기본 성격
- `avatarPersonalityPrompt` 자유텍스트 800자 — 구조화 없음
- 감정 시스템(`emotionTuning`)은 애니메이션 파라미터만 제어, 대화 톤에 영향 없음
- 성격 프리셋/템플릿 없음, 캐릭터 배경/로어 없음, 관계 진화 없음

### 설계 원칙

AMA는 다양한 외부 LLM(Claude/GPT/Gemini/Ollama)을 라우팅하는 구조이므로 모델 파인튜닝보다 **프롬프트 엔지니어링 + 구조화된 캐릭터 시스템**이 적합하다.

---

## Phase 개요

```
Phase 0 (캐릭터 프로필) → Phase 1 (스트리밍) → Phase 2 (메모리) → Phase 3 (자발적 대화) → Phase 4 (컨텍스트) → Phase 5 (감정 연속성)
                                                                                                                        ↓ (선택)
                                                                                                                    Phase 6 (파인튜닝)
```

Phase 0~5는 순차 머지, Phase 6(파인튜닝)은 Ollama 로컬 모델 사용자 전용 선택 사항이다.

---

## Phase 0: 캐릭터 프로필 시스템 ✅

**브랜치**: `feature/character-profile`
**커밋**: `ff600a7`

### 목표

단순 자유텍스트 대신, 구조화된 캐릭터 프로필로 일관된 성격 표현의 기반 마련

### 변경 내역

| 구분 | 파일 | 내용 |
|------|------|------|
| 신규 | `src/services/character/characterProfile.ts` | CharacterProfile 타입 + 다층 프롬프트 빌더 |
| 신규 | `src/services/character/presets.ts` | 내장 프리셋 5종 (genki/cool/neko/calm/trickster) |
| 신규 | `src/services/character/emotionWeights.ts` | archetype별 감정 가중치 매트릭스 |
| 신규 | `src/services/character/analyzeEmotion.ts` | 감정 분석 통합 (중복 코드 제거) |
| 신규 | `src/services/character/index.ts` | 퍼블릭 API |
| 신규 | `src/components/settings/CharacterSettings.tsx` | 캐릭터 편집 UI |
| 변경 | `src/stores/settingsStore.ts` | `character: CharacterProfile` 추가, v14→v15 마이그레이션 |
| 변경 | `src/hooks/useConversation.ts` | `buildSystemPrompt` → 캐릭터 프로필 기반 |
| 변경 | `src/features/channels/responseProcessor.ts` | 중복 analyzeEmotion 제거 → 통합 모듈 |
| 변경 | `src/components/ui/SettingsPanel.tsx` | CharacterSettings 섹션 추가 |
| 변경 | `src/components/settings/AvatarSettings.tsx` | 이름/성격 프롬프트 입력 제거 |
| 변경 | `src/i18n/ko.json`, `en.json`, `ja.json` | `settings.character.*` 번역 키 |

### 캐릭터 프로필 타입

```typescript
interface CharacterProfile {
  name: string;
  age?: string;
  species?: string;
  personality: {
    archetype: CharacterArchetype; // genki | cool | neko | calm | trickster | custom
    traits: string[];              // 최대 5개
    speechStyle: string;
    emotionalTendency: EmotionalTendency;
  };
  background?: string;
  likes?: string[];
  dislikes?: string[];
  exampleDialogues: ExampleDialogue[];
  userRelation: string;
  honorific: 'casual' | 'polite' | 'mixed';
}
```

### 다층 시스템 프롬프트 아키텍처

```
Layer 1: 코어 아이덴티티 (이름/종족/성격/말투)
Layer 2: 행동 규칙 (존댓말/답변길이/감정성향)
Layer 3: 배경/로어 (있을 때만)
Layer 4: Few-shot 예시 (있을 때만)
Layer 5: 메모리/컨텍스트 (Phase 2~4에서 추가)
```

### archetype별 감정 가중치

| Archetype | happy 민감도 | sad 표현 | angry 표현 | surprised 민감도 |
|-----------|------------|---------|----------|----------------|
| genki     | 1.5x       | 0.7x   | 1.0x     | 1.3x           |
| cool      | 0.7x       | 0.6x   | 0.7x     | 0.6x           |
| neko      | 1.3x       | 1.4x   | 0.8x     | 1.4x           |
| calm      | 0.8x       | 1.0x   | 0.9x     | 0.7x           |
| trickster | 1.2x       | 0.8x   | 0.8x     | 1.3x           |

### 마이그레이션

- settingsStore persist version 14 → 15
- 기존 `avatarName` → `character.name`
- 기존 `avatarPersonalityPrompt` → `character.background`
- archetype은 `custom`으로 설정

---

## Phase 1: Streaming Response + 실시간 감정 ✅

**브랜치**: `feature/streaming-response`
**커밋**: `476e4ac`

### 목표

LLM 응답을 토큰 단위로 스트리밍해서 말풍선에 실시간 표시 + 문장 단위 TTS 파이프라이닝

### 변경 내역

| 구분 | 파일 | 내용 |
|------|------|------|
| 신규 | `src/services/voice/ttsQueue.ts` | 문장 단위 TTS 큐 (파이프라이닝/인터럽트) |
| 변경 | `src/stores/conversationStore.ts` | `streamingResponse` + `appendStreamingToken` |
| 변경 | `src/hooks/useConversation.ts` | `llmRouter.chat()` → `chatStream()` 전환 |

### TTS 큐 파이프라인

```
onToken("오늘") → 버퍼 누적
onToken("날씨") → 버퍼 누적
onToken("좋다!") → 문장 종결 감지 → 큐 push → synthesize → 재생
onToken("산책")  → 버퍼 누적 (재생과 병렬)
onToken("갈까?") → 큐 push → 미리 synthesize → 첫 문장 완료 후 즉시 재생
```

### 문장 종결 감지 패턴

```
/[.!?~。！？]\s*$|[요다야지니까네죠래라][\s!?~]*$|[\n]/
```

### 실시간 감정 분석

- 누적 텍스트에서 50자마다 감정 분석 → 아바타 감정 갱신
- 인터럽트 시 `ttsQueue.flush()` → 큐 전체 + 현재 재생 즉시 중단

---

## Phase 2: 대화 메모리 시스템 ✅

**브랜치**: `feature/conversation-memory`
**커밋**: `35028f7`

### 목표

무한히 늘어나는 대화 기록 대신, 요약 기반 장기 기억 + 최근 대화 윈도우로 맥락 유지

### 변경 내역

| 구분 | 파일 | 내용 |
|------|------|------|
| 신규 | `src/services/ai/memoryManager.ts` | 슬라이딩 윈도우 + 자동 요약 + 사실 추출 |
| 변경 | `src/stores/conversationStore.ts` | `memory: MemoryState` (persist) |
| 변경 | `src/hooks/useConversation.ts` | 메모리 윈도우 기반 메시지 구성 |

### 시스템 프롬프트 구조

```
┌─────────────────────────────┐
│ 캐릭터 프로필 (Phase 0)      │
├─────────────────────────────┤
│ 장기 기억 요약 (summary)     │
├─────────────────────────────┤
│ 중요 사실 (importantFacts)   │
├─────────────────────────────┤
│ 최근 20개 대화               │
└─────────────────────────────┘
```

### 핵심 상수

- `WINDOW_SIZE = 20` (최근 메시지 수)
- `SUMMARIZE_THRESHOLD = 10` (미요약 메시지 누적 시 트리거)
- 요약은 비동기로 실행 (UI 차단 없음)
- `importantFacts` 최대 10개, 중복 자동 제거

---

## Phase 3: 자발적 대화 (Proactive Conversation) ✅

**브랜치**: `feature/proactive-chat`
**커밋**: `918c646`

### 목표

사용자가 말을 걸지 않아도 아바타가 먼저 말을 건다

### 변경 내역

| 구분 | 파일 | 내용 |
|------|------|------|
| 신규 | `src/services/ai/proactiveEngine.ts` | 유휴 감지 + 3종 트리거 + 쿨다운 |
| 변경 | `src/stores/settingsStore.ts` | `proactive: ProactiveSettings` |
| 변경 | `src/hooks/useConversation.ts` | proactiveEngine 연동, 포커스 복귀 감지 |
| 변경 | `src/components/settings/CharacterSettings.tsx` | ON/OFF 토글 + 슬라이더 |
| 변경 | `src/i18n/ko.json`, `en.json`, `ja.json` | `settings.proactive.*` |

### 트리거 유형

| 트리거 | 조건 | 예시 |
|--------|------|------|
| `idle_greeting` | 사용자 입력 없이 N분 경과 | "뭐 하고 있어?" |
| `time_greeting` | 시간대 인사 (첫 트리거 또는 6시간 경과) | "아침이다! 잘 잤어?" |
| `return_greeting` | 앱 포커스 복귀 | "어디 갔다 왔어?" |

### 안전 가드레일

- 기본 OFF (사용자가 명시적으로 활성화)
- 대화 중 또는 TTS 재생 중이면 보류
- 쿨다운: 자발 발화 후 최소 N분 재발화 방지 (기본 10분)
- 논쟁적 주제/정치/종교 발언 금지 지시
- 최대 2문장, `maxTokens: 100`

### 설정

```typescript
interface ProactiveSettings {
  enabled: boolean;        // 기본 false
  idleMinutes: number;     // 1~30, 기본 5
  cooldownMinutes: number; // 1~60, 기본 10
}
```

---

## Phase 4: 컨텍스트 인식 ✅

**브랜치**: `feature/context-awareness`
**커밋**: `447c0b1`

### 목표

시간, 시스템 이벤트를 인식해서 대화에 반영

### 변경 내역

| 구분 | 파일 | 내용 |
|------|------|------|
| 신규 | `src/services/context/contextCollector.ts` | 시간/요일/심야/세션 시간 수집 |
| 신규 | `src/services/context/index.ts` | 퍼블릭 API |
| 변경 | `src/hooks/useConversation.ts` | 시스템 프롬프트에 컨텍스트 자동 주입 |

### 수집 항목

| 항목 | 설명 | 프롬프트 반영 |
|------|------|--------------|
| 시각 | 시/분/오전오후 | 항상 |
| 요일 | 월~일 | 항상 |
| 심야 여부 | 23시~5시 | "건강 걱정해주세요" 힌트 |
| 세션 시간 | 앱 실행 이후 경과 분 | 2시간 초과 시 알림 |

### 프롬프트 주입 예시

```
[현재 컨텍스트]
현재 시각: 오후 11시 30분 (금요일)
늦은 시간입니다. 사용자의 건강을 걱정해주세요.
사용자가 3시간 넘게 앱을 사용 중입니다.
```

### 향후 확장 (미구현)

- 화면 인식: 기존 `screenAnalyzer` 활용, 주기적(5분) 스크린샷 요약 → 기본 OFF + 명시적 동의 필요
- 시스템 이벤트: 배터리 저하 등

---

## Phase 5: 대화 스타일 고도화 ✅

**브랜치**: `feature/advanced-dialogue`
**커밋**: `daf02dd`

### 목표

감정 연속성으로 더 자연스러운 대화

### 변경 내역

| 구분 | 파일 | 내용 |
|------|------|------|
| 변경 | `src/stores/conversationStore.ts` | `mood: Emotion` 필드 (지속 감정) |
| 변경 | `src/hooks/useConversation.ts` | mood 기반 프롬프트 힌트 + 감정 연속성 |

### 감정 연속성 로직

- **mood 업데이트**: 응답 감정 score ≥ 2일 때만 mood 변경 (약한 감정은 무시)
- **mood 복귀**: 감정 없는 응답 시 neutral로 복귀
- **프롬프트 반영**: `[현재 기분: happy — 이 기분을 대화 톤에 자연스럽게 반영하세요]`

### 인터럽트 (Phase 1에서 구현)

- 사용자 음성 입력 시 `ttsQueue.flush()` → TTS 즉시 중단
- voice command `stop-speaking`에서도 큐 flush

---

## Phase 6: 성격 파인튜닝 (선택/미구현)

**상태**: 미구현 — Ollama 로컬 모델 사용자 전용 선택 사항

### 구현 시 범위

- `src/services/character/fineTuneExporter.ts` — 대화 로그를 ChatML 학습 데이터로 내보내기
- `CharacterSettings.tsx`에 "학습 데이터 내보내기" 버튼
- 실제 파인튜닝은 앱 외부에서 수행 (Unsloth/LLaMA-Factory)

### 사전 조건

- Phase 0의 캐릭터 프로필 완성
- Phase 2의 메모리 시스템으로 50~200개 고품질 대화 수집
- 학습 환경: RTX 4090 (24GB VRAM) 또는 클라우드 GPU

---

## 브랜치 전략

```
develop (기준)
  ├── feature/character-profile    ← Phase 0 ✅
  ├── feature/streaming-response   ← Phase 1 ✅
  ├── feature/conversation-memory  ← Phase 2 ✅
  ├── feature/proactive-chat       ← Phase 3 ✅
  ├── feature/context-awareness    ← Phase 4 ✅
  ├── feature/advanced-dialogue    ← Phase 5 ✅
  └── feature/personality-finetune ← Phase 6 (미구현)
```

각 브랜치는 순차 체이닝 (0→1→2→3→4→5). `develop`에 머지할 때 순서대로 진행.

---

## 신규 폴더/파일 구조

```
src/
├── services/
│   ├── character/                    ← Phase 0
│   │   ├── index.ts
│   │   ├── characterProfile.ts
│   │   ├── presets.ts
│   │   ├── emotionWeights.ts
│   │   └── analyzeEmotion.ts
│   │
│   ├── context/                      ← Phase 4
│   │   ├── index.ts
│   │   └── contextCollector.ts
│   │
│   ├── ai/
│   │   ├── memoryManager.ts          ← Phase 2
│   │   └── proactiveEngine.ts        ← Phase 3
│   │
│   └── voice/
│       └── ttsQueue.ts               ← Phase 1
│
└── components/settings/
    └── CharacterSettings.tsx         ← Phase 0
```

---

## 리스크 & 대응

| 리스크 | 영향 Phase | 대응 |
|--------|-----------|------|
| 시스템 프롬프트 길이 → 토큰 비용 | P0, P2, P4 | 각 레이어 길이 제한, 불필요 레이어 생략 |
| Claude Code/Codex 경로 | P0, P1 | fire-and-forget 유지, 캐릭터 프로필 미적용 |
| TTS 큐 립싱크 타이밍 | P1 | 문장 간 onLipSyncStart/Stop 콜백 |
| 자발적 대화 → 사용자 방해 | P3 | 기본 OFF + 쿨다운 + DnD 고려 |
| settingsStore 마이그레이션 체이닝 | P0, P3 | v14→v15(P0) + proactive는 normalizeSettings에서 처리 |
| 감정 분석 중복 코드 | P0 | 통합 완료 (analyzeEmotion.ts) |
