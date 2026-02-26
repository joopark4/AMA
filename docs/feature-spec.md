# MyPartnerAI 기능 명세서

> 최종 수정: 2026-02-23
> 버전: 0.3.0
> 플랫폼: macOS (Tauri 2.x + React 18 + Three.js)

---

## 목차

1. [AI 대화](#1-ai-대화)
2. [음성 인식 (STT)](#2-음성-인식-stt)
3. [음성 합성 (TTS)](#3-음성-합성-tts)
4. [음성 명령어](#4-음성-명령어)
5. [화면 분석 (Vision)](#5-화면-분석-vision)
6. [대화 기록](#6-대화-기록)
7. [아바타 렌더링](#7-아바타-렌더링)
8. [표정 시스템](#8-표정-시스템)
9. [제스처 시스템](#9-제스처-시스템)
10. [모션 클립](#10-모션-클립)
11. [댄스 애니메이션](#11-댄스-애니메이션)
12. [립싱크](#12-립싱크)
13. [아바타 이동](#13-아바타-이동)
14. [아바타 드래그 & 회전](#14-아바타-드래그--회전)
15. [조명 제어](#15-조명-제어)
16. [클릭스루 (투명 윈도우)](#16-클릭스루-투명-윈도우)
17. [글로벌 단축키](#17-글로벌-단축키)
18. [설정 패널](#18-설정-패널)
19. [대화 기록 패널](#19-대화-기록-패널)
20. [다국어 지원](#20-다국어-지원)
21. [인증 (OAuth)](#21-인증-oauth)
22. [약관 동의](#22-약관-동의)
23. [계정 탈퇴](#23-계정-탈퇴)

---

## 1. AI 대화

### 기능 설명
사용자의 음성 또는 텍스트 입력을 받아 LLM에 전달하고 응답을 생성한다.

### 지원 LLM 프로바이더

| 프로바이더 | 유형 | 설정 필요 사항 |
|-----------|------|--------------|
| Ollama | 로컬 | 엔드포인트 URL |
| LocalAI | 로컬 | 엔드포인트 URL |
| Claude (Anthropic) | 클라우드 | API 키 |
| OpenAI | 클라우드 | API 키 |
| Google Gemini | 클라우드 | API 키 |

### 관련 파일
- `src/services/ai/llmRouter.ts`
- `src/services/ai/{claudeClient, openaiClient, geminiClient, ollamaClient, localAiClient}.ts`
- `src/hooks/useConversation.ts`

### 동작 흐름
```
사용자 입력 (음성/텍스트)
  → 아바타 이름/성격 프롬프트 포함한 시스템 메시지 구성
  → 대화 이력 포함하여 LLM 전송
  → 응답 수신 → TTS 재생 + 감정 분석 → 아바타 리액션
```

### 정책
- **API 키 저장:** 로컬 `localStorage`에만 저장. 클라우드(Supabase)에 전송하지 않음
- **대화 이력 전송:** LLM 호출 시 이전 메시지를 컨텍스트로 포함. 서버에 따로 저장하지 않음
- **기본 프로바이더:** Ollama (`deepseek-v3`)
- **연결 실패 처리:** 15초 타임아웃 후 에러 상태로 전환. 사용자에게 에러 메시지 표시
- **스트림 지원:** 프로바이더별로 스트림/논-스트림 자동 선택

---

## 2. 음성 인식 (STT)

### 기능 설명
마이크로 녹음한 음성을 로컬 Whisper 모델로 텍스트 변환한다.

### 지원 모델

| 모델 | 정확도 | 속도 | 권장 용도 |
|------|-------|------|---------|
| `base` | 낮음 | 빠름 | 기본값, 빠른 응답 |
| `small` | 중간 | 중간 | 균형 |
| `medium` | 높음 | 느림 | 고정확도 필요 시 |

### 관련 파일
- `src-tauri/src/commands/voice.rs`
- `src/services/voice/audioProcessor.ts`
- `src/hooks/useConversation.ts`

### 동작 흐름
```
마이크 권한 확인
  → 16kHz 모노 WAV 녹음
  → Tauri invoke('transcribe_audio')
  → whisper-cli 로컬 실행
  → 텍스트 반환 → 대화 처리
```

### 정책
- **엔진 고정:** `whisper` 단일 경로. 다른 STT 엔진 미지원
- **로컬 처리:** 음성 데이터를 외부 서버로 전송하지 않음. 완전 오프라인 동작
- **원격 세션 차단:** SSH, Chrome Remote Desktop, TeamViewer 등 원격 환경에서 음성 입력 비활성화. 텍스트 입력은 가능
- **마이크 권한:** macOS 런타임 권한 요청. 거부 시 시스템 환경설정으로 이동 안내
- **모델 누락 처리:** Whisper 런타임 또는 모델 파일 없을 시 설치 안내 모달 표시
- **음성 파일 임시 저장:** 변환 완료 후 임시 WAV 파일 자동 삭제

---

## 3. 음성 합성 (TTS)

### 기능 설명
AI 응답 텍스트를 로컬 Supertonic ONNX 모델로 음성으로 변환해 재생한다.

### 지원 음성

| 코드 | 성별 | 비고 |
|------|------|------|
| F1~F5 | 여성 | F1이 기본값 |
| M1~M5 | 남성 | |

### 관련 파일
- `src/services/voice/ttsRouter.ts`
- `src/services/voice/supertonicClient.ts`
- `src/hooks/useSpeechSynthesis.ts`
- `public/models/supertonic/` (ONNX 모델)

### 동작 흐름
```
AI 응답 텍스트
  → supertonicClient.synthesize(text, voice)
  → ONNX 추론 (로컬)
  → PCM 오디오 생성
  → HTML Audio API 재생 (실패 시 Web Audio API 폴백)
```

### 정책
- **엔진 고정:** `supertonic` 단일 경로
- **로컬 처리:** 텍스트를 외부 TTS 서버로 전송하지 않음
- **중복 재생 방지:** 이전 재생 중이면 중단 후 새 재생 시작
- **모델 경로:** 개발 시 Vite 서버(`/models/supertonic`) → 배포 시 앱 번들 내 포함
- **재생 실패 처리:** HTML Audio 실패 시 Web Audio API로 자동 전환. 양쪽 모두 실패 시 에러 로그만 기록하고 대화는 계속 진행

---

## 4. 음성 명령어

### 기능 설명
특정 패턴의 발화를 인식해 앱 제어 명령으로 실행한다. LLM에 전달하지 않음.

### 지원 명령어

| 명령 유형 | 한국어 예시 | 영어 예시 |
|---------|-----------|---------|
| 설정 열기 | "설정 열어줘" | "open settings" |
| 설정 닫기 | "설정 닫아" | "close settings" |
| 마이크 설정 | "마이크 설정 열어" | "open microphone settings" |
| 대화 기록 삭제 | "대화 기록 지워" | "clear messages" |
| 음성 중지 | "조용히", "말 그만해" | "stop speaking", "be quiet" |
| 언어 변경 | "한국어로 해줘" | "switch to english" |
| 도움말 | "음성 명령어 알려줘" | "voice commands help" |

### 관련 파일
- `src/services/voice/voiceCommandParser.ts`
- `src/hooks/useConversation.ts`

### 정책
- **우선순위:** 명령어 패턴 매칭이 LLM 호출보다 우선. 명령어로 인식되면 LLM 전송 안 함
- **정규식 매칭:** 한/영 혼용 패턴 지원. 대소문자 무관
- **명령 실행 후 응답:** 명령 실행 결과를 TTS로 안내 (예: "설정을 열었습니다")
- **미인식 처리:** 명령어 패턴 불일치 시 일반 대화로 처리

---

## 5. 화면 분석 (Vision)

### 기능 설명
현재 화면을 캡처해 Vision 지원 LLM에 전달하고, 화면 내용에 대한 도움을 제공한다.

### 관련 파일
- `src/services/ai/screenAnalyzer.ts`
- `src-tauri/src/commands/screenshot.rs`
- `src/hooks/useScreenCapture.ts`

### 트리거 키워드
"화면", "스크린", "screen", "보여줘", "이 페이지" 등의 키워드가 포함된 발화

### 정책
- **지원 프로바이더:** Claude, OpenAI, Gemini만 지원. Ollama/LocalAI에서 Vision 요청 시 에러 안내
- **원격 세션 차단:** 원격 환경에서 화면 캡처 불가 (보안)
- **스크린샷 전송:** Base64 인코딩 후 LLM API에만 전송. 디스크에 저장하지 않음
- **macOS 권한:** 화면 녹화 권한 필요. 미승인 시 시스템 환경설정 안내

---

## 6. 대화 기록

### 기능 설명
사용자와 AI의 대화를 로컬에 저장하고 조회한다.

### 관련 파일
- `src/stores/conversationStore.ts`
- `src/components/ui/HistoryPanel.tsx`

### 저장 구조

```typescript
Message {
  id: string        // UUID
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number // Unix ms
}
```

### 정책
- **저장 위치:** `localStorage` (`mypartnerai-conversation` 키). 클라우드 저장 없음
- **저장 한도:** 무제한 (기존 500개 제한 제거)
- **저장 대상:** `messages` 배열만 persist. `status`, `currentResponse` 등 런타임 상태는 저장하지 않음
- **삭제 수단:** 사용자 직접 삭제(히스토리 패널 "기록 지우기"), 음성 명령("대화 기록 지워"), 계정 탈퇴 시 자동 삭제
- **외부 공유 없음:** 대화 내용을 서버로 전송하거나 제3자와 공유하지 않음

---

## 7. 아바타 렌더링

### 기능 설명
VRM 형식의 3D 아바타를 투명 오버레이 윈도우 위에 렌더링한다.

### 관련 파일
- `src/hooks/useVRM.ts`
- `src/components/avatar/AvatarCanvas.tsx`
- `src/components/avatar/VRMAvatar.tsx`

### VRM 파일 설정

| 항목 | 내용 |
|------|------|
| 형식 | `.vrm` (VRM 0.x / 1.0) |
| 번들 여부 | 미포함. 최초 실행 시 사용자가 직접 선택 |
| 저장 위치 | 파일 절대 경로를 `settings.vrmModelPath`에 저장 |
| 변경 방법 | 설정 패널 → 아바타 탭 → "모델 선택" |

### 정책
- **기본 VRM 없음:** 앱에 기본 아바타를 동봉하지 않음. 사용자가 직접 VRM 파일 선택 필요
- **첫 실행:** VRM 미설정 상태에서는 아바타 없이 UI만 표시
- **로드 최적화:** 불필요한 조인트/버텍스 자동 제거 (`VRMUtils`)
- **로드 실패:** 명확한 에러 메시지 표시. 재로드 버튼 제공
- **레거시 경로 무효화:** 이전 번들 VRM 경로(`/vrm/eunyeon_ps.vrm`)는 자동으로 빈 값으로 초기화

---

## 8. 표정 시스템

### 기능 설명
AI 응답 감정에 따라 아바타의 표정을 자동으로 변경한다.

### 지원 감정

| 감정 | 트리거 상황 |
|------|-----------|
| `neutral` | 대기 상태 (일정 시간 후 자동 복귀) |
| `happy` | 긍정적 응답, 인사 등 |
| `sad` | 슬픈 내용, 에러 발생 |
| `angry` | 부정적·강한 감정 응답 |
| `surprised` | 놀람 표현 |
| `relaxed` | 차분한 응답 |
| `thinking` | LLM 처리 중 |

### 관련 파일
- `src/components/avatar/ExpressionController.tsx`

### 정책
- **표정 블렌딩:** `expressionBlendSpeed`(기본 0.1)로 부드럽게 전환. 즉각 변환 없음
- **립싱크 독립:** 표정 변화와 립싱크 애니메이션은 독립적으로 동작
- **Face-expression-only 모드:** 활성화 시 표정만 변화하고 모션 클립/제스처/댄스 모두 비활성화
- **상태 오버라이드:** `processing` → thinking, `error` → sad 강제 적용

---

## 9. 제스처 시스템

### 기능 설명
음성 내용이나 감정에 따라 아바타가 팔/머리 동작으로 반응한다.

### 지원 제스처

| 제스처 | 동작 | 주요 트리거 |
|--------|------|-----------|
| `wave` | 손 흔들기 | "안녕", "hello" |
| `nod` | 끄덕이기 | 긍정 응답 |
| `shake` | 고개 흔들기 | 부정·거부 |
| `shrug` | 어깨 으쓱 | 모름·불확실 |
| `thinking` | 생각 포즈 | 처리 중 |
| `celebrate` | 축하 동작 | 성공·기쁨 |

### 관련 파일
- `src/components/avatar/GestureController.tsx`
- `src/animation/gestureDefinitions.ts`

### 정책
- **활성화 조건:** `settings.avatar.animation.enableGestures = true`
- **Face-expression-only 모드에서 비활성화**
- **이동 중 제스처 금지:** 아바타 이동 중일 때 제스처 스킵
- **모션 클립 우선:** 모션 클립 재생 중엔 제스처 실행 안 함
- **큐 기반 실행:** 현재 제스처 완료 후 다음 제스처 자동 실행

---

## 10. 모션 클립

### 기능 설명
감정/강도에 맞는 전신 동작 애니메이션을 확률 기반으로 선택해 재생한다.

### 모션 카탈로그 구조

| 항목 | 내용 |
|------|------|
| 최소 클립 수 | 24개 이상 |
| 감정 태그 | neutral, happy, sad, angry, surprised, thinking, relaxed, bridge |
| 강도 레벨 | low / mid / high |
| 메타데이터 | 지속시간, 루프 가능 여부, 쿨다운(ms), 우선순위 |

### 관련 파일
- `src/services/avatar/motionLibrary.ts`
- `src/services/avatar/motionSelector.ts`
- `src/components/avatar/ClipMotionController.tsx`
- `motions/clean/catalog.json`

### 선택 알고리즘
```
1. 현재 감정·강도 기준으로 후보 클립 필터링
2. 최근 재생 이력(3개 윈도우) 페널티 적용
3. 쿨다운 중인 클립 제외
4. 가중치 기반 확률 선택
5. dynamicMotionBoost(0~1.5) 반영
```

### 정책
- **활성화 조건:** `settings.avatar.animation.enableMotionClips = true`
- **다양성 설정:** `motionDiversity`(0~1.0) — 낮을수록 자주 쓰는 클립 반복
- **쿨다운:** 클립별 쿨다운 기간 후에만 재사용 가능. 반복 재생 방지
- **Face-expression-only 모드에서 비활성화**

---

## 11. 댄스 애니메이션

### 기능 설명
행복 감정의 AI 응답 시 음악 비트에 맞춰 아바타가 춤을 춘다.

### 구현 방식
**단일 통합 애니메이션.** 6개의 본 제너레이터(`headBob`, `bodyBounce`, `shoulderMove`, `armSway`, `hipSway`, `legBounce`)가 매 프레임 동시에 실행되어 `combineDanceMoves()`로 합산된다. 각 제너레이터는 독립된 사인파 기반 수식으로 해당 뼈의 회전값을 계산하며, 모든 결과를 하나의 뼈 회전 오프셋으로 합쳐 적용한다.

### 관련 파일
- `src/components/avatar/DanceController.tsx`
- `src/services/audio/rhythmAnalyzer.ts`

### 정책
- **활성화 조건:** `settings.avatar.animation.enableDancing = true` + 응답 감정이 `happy`
- **강도 설정:** `danceIntensity`(0~1.0, 기본 0.7)
- **자동 종료:** `happyDanceMs`(기본 3500ms) 후 자동 종료
- **리듬 소스:** 오디오 미연결 시 `simulateBeat(110 BPM)`으로 자동 시뮬레이션
- **Face-expression-only 모드에서 비활성화**
- **모션 클립과 독립:** 댄스 중에도 표정은 변화 가능

---

## 12. 립싱크

### 기능 설명
TTS 재생 음성의 주파수를 분석해 아바타의 입 모양을 실시간으로 동기화한다.

### 관련 파일
- `src/hooks/useLipSync.ts`
- `src/hooks/useSpeechSynthesis.ts`

### 동작 원리
```
Web Audio API로 TTS 오디오 분석
  → 85~255Hz 음성 주파수 범위 포커싱
  → 볼륨(0~1) → 입 열림값 매핑
  → 80ms마다 VRM expressionManager 업데이트
  → 사인파 보정으로 자연스러운 움직임
```

### 정책
- **TTS 연동 전용:** TTS 재생 중에만 활성화. 입력 음성에는 적용하지 않음
- **표정과 독립:** 립싱크와 감정 표정은 별도 채널로 동시 적용
- **언마운트 자동 정리:** 컴포넌트 해제 시 AudioContext 정리

---

## 13. 아바타 이동

### 기능 설명
아바타가 화면 위를 자연스러운 보행 스타일로 자율 이동한다.

### 이동 스타일

| 스타일 | 특성 |
|--------|------|
| `stroll` | 여유로운 산책 (기본) |
| `brisk` | 빠른 걸음 |
| `sneak` | 살금살금 |
| `bouncy` | 튀는 움직임 |

### 관련 파일
- `src/components/avatar/HumanoidSyncController.tsx`
- `src/components/avatar/PhysicsController.tsx`

### 설정 옵션

| 설정 | 범위 | 기본값 |
|------|------|-------|
| `movementSpeed` | 0~100 | 50 |
| `freeMovement` | boolean | false |
| `physics.enabled` | boolean | true |
| `physics.gravityMultiplier` | 수치 | 1.0 |
| `physics.stiffnessMultiplier` | 수치 | 1.0 |

### 자유 이동 모드

`freeMovement: true` 시 아바타를 화면 어디든 자유롭게 배치할 수 있다.

| 항목 | 기본 모드 (`false`) | 자유 이동 모드 (`true`) |
|------|-------------------|----------------------|
| Y축 이동 | 화면 하단 고정 | 제한 없음 |
| 화면 밖 이동 | 불가 | 가능 |
| 자율 보행 | 좌우 이동 | 좌우 이동 (Y축 유지) |
| 모드 전환 시 | — | OFF 전환 시 하단 위치로 복귀 |

### 정책
- **화면 경계 제약 (기본 모드):** 화면 밖으로 이동 불가. 경계 도달 시 방향 전환
- **자유 배치 (자유 이동 모드):** 화면 밖 포함 어디든 배치 가능
- **대각선 이동 지원**
- **드래그 중 이동 정지:** 사용자가 드래그 중엔 자율 이동 정지

---

## 14. 아바타 드래그 & 회전

### 기능 설명
마우스로 아바타를 화면 내 원하는 위치로 이동하거나 회전각을 조정한다.

### 관련 파일
- `src/components/avatar/DragController.tsx`
- `src/hooks/useWindowDrag.ts`

### 조작법

| 조작 | 동작 |
|------|------|
| 아바타 클릭 후 드래그 | 자유 이동 |
| 머리 클릭 후 좌우 드래그 | 좌우 회전 |
| 머리 클릭 후 상하 드래그 | 상하 회전 |

### 정책
- **회전 범위 제한:** 상하(`x`) -0.5~0.5, 좌우(`y`) 무제한
- **초기 회전 저장:** `settings.avatar.initialViewRotation`에 저장해 재시작 후에도 유지
- **경계 제약:** 기본 모드에서는 화면 밖 드래그 불가. 자유 이동 모드(`freeMovement`)에서는 제한 없음
- **스케일 반영:** 클릭 인식 영역이 `avatar.scale` 값에 맞게 자동 조정

---

## 15. 조명 제어

### 기능 설명
아바타에 적용되는 주변광·방향광의 세기와 방향을 조정한다.

### 관련 파일
- `src/components/avatar/LightingControl.tsx`

### 설정 옵션

| 설정 | 범위 | 기본값 |
|------|------|-------|
| `ambientIntensity` | 0~2 | 1.0 |
| `directionalIntensity` | 0~2 | 1.0 |
| `directionalPosition.x` | 수치 | 0 |
| `directionalPosition.y` | 수치 | 1 |
| `directionalPosition.z` | 수치 | 2 |

### 정책
- **실시간 적용:** 슬라이더 조정 즉시 반영
- **설정 저장:** 변경값이 `settings.avatar.lighting`에 자동 저장

---

## 16. 클릭스루 (투명 윈도우)

### 기능 설명
투명 오버레이 윈도우 위에서 아바타와 UI 요소 외의 영역은 클릭이 하단 앱으로 통과한다.

### 관련 파일
- `src/hooks/useClickThrough.ts`
- `src-tauri/src/commands/window.rs`

### 인터랙티브 영역 (클릭 통과 안 됨)
- 아바타 본체 (3D AABB 기반 몸통 영역 자동 계산)
- 조명 컨트롤 (태양 아이콘)
- 설정 버튼
- 설정 패널 (`data-interactive="true"`)
- 히스토리 패널
- 말풍선 (`showSpeechBubble` 활성화 시)
- 상태 표시기

### 아바타 히트박스 계산
- `interactionBounds` (3D AABB → 2D 투영) 사용 시: AABB 너비의 55% (몸통+어깨), 높이의 85% (상단 15% 머리카락 제외)
- `interactionBounds` 미사용 시: 아바타 발 위치 기준 고정 크기 폴백 (스케일 반영)
- 매 프레임 `publishInteractionBounds()`로 갱신 → 30ms 폴링으로 실시간 반영

### 커서 좌표 처리 (멀티 모니터 대응)
- Rust 백엔드(`get_cursor_position`)에서 윈도우-로컬 좌표를 직접 계산
- macOS: `NSEvent::mouseLocation` → Cocoa 좌표 → 탑-레프트 변환 → 윈도우 오프셋 적용
- `app.run_on_main_thread()`로 AppKit API를 메인 스레드에서 실행 (백그라운드 스레드 행 방지)
- `NSScreen::screens()[0]` (프라이머리 스크린)으로 Y좌표 변환 (멀티 모니터 정확도 보장)
- 프런트엔드는 좌표 변환 없이 Rust가 반환한 로컬 좌표를 직접 사용

### 정책
- **판별 방식:** 커서 위치를 30ms 간격으로 폴링해 인터랙티브 영역 여부를 Tauri `set_ignore_cursor_events`로 전달
- **지연 전환:** 인터랙티브 영역 진입 시 즉시 비활성화, 이탈 시 180ms 지연 후 활성화
- **스케일 반영:** 아바타 인터랙티브 영역은 3D AABB에서 자동 계산되어 스케일/위치 변경 실시간 반영
- **데이터 속성 기반:** `data-interactive="true"` 속성을 가진 DOM 요소는 클릭 통과 차단
- **조작 보호:** 드래그/회전 중에는 클릭스루 비활성화 (제스처 중단 방지)

---

## 17. 글로벌 단축키

### 기능 설명
다른 앱을 사용 중에도 등록된 키 조합으로 음성 입력을 토글한다.

### 관련 파일
- `src/hooks/useGlobalVoiceShortcut.ts`
- Tauri `global-shortcut` 플러그인

### 기본 단축키

| OS | 기본값 |
|----|-------|
| macOS | `Cmd+Shift+Space` |
| Windows/Linux | `Ctrl+Shift+Space` |

### 정책
- **활성화 조건:** `settings.globalShortcut.enabled = true`
- **사용자 정의:** 설정 패널에서 키 조합 변경 가능 (modifier + 일반 키 필수)
- **등록 실패 처리:** 다른 앱에서 이미 사용 중인 조합이면 에러 메시지 표시. 대안 조합 직접 입력 필요
- **접근성 권한:** macOS에서 글로벌 단축키 동작에 접근성 권한 필요할 수 있음. 실패 시 접근성 설정 열기 버튼 제공
- **앱 종료 시 해제:** 앱 종료 또는 설정 비활성화 시 단축키 등록 해제

---

## 18. 설정 패널

### 기능 설명
모든 앱 설정을 조회하고 변경하는 슬라이드 인 패널.

### 섹션 구성

| 섹션 | 주요 설정 항목 |
|------|--------------|
| 계정 | OAuth 로그인/로그아웃, 계정 삭제 |
| 언어 | 한국어 / 영어 |
| AI 모델 | 프로바이더, 모델명, API 키, 엔드포인트 |
| 음성 | STT 모델, TTS 음성, 글로벌 단축키 |
| 아바타 | VRM 파일, 이름, 스케일, 자유 이동, 말풍선, 물리, 애니메이션, 조명 |
| 라이선스 | 오픈소스 및 AI 서비스 라이선스 정보 |

### 관련 파일
- `src/components/ui/SettingsPanel.tsx`
- `src/stores/settingsStore.ts`

### 정책
- **즉시 저장:** 설정 변경 즉시 `localStorage`에 persist. 저장 버튼 불필요
- **설정 버전 관리:** 스토어 버전 12. 구버전 설정값 자동 정규화
- **초기화:** 설정 초기화 버튼으로 모든 설정을 기본값으로 복원
- **API 키 보호:** API 키는 UI에서 마스킹(`password` 필드)로 표시

---

## 19. 대화 기록 패널

### 기능 설명
이전 대화 내용을 시간순으로 조회하는 부동(floating) 패널.

### 관련 파일
- `src/components/ui/HistoryPanel.tsx`
- `src/stores/settingsStore.ts` (`historyPanel` 설정)

### 패널 설정

| 설정 | 기본값 |
|------|-------|
| 초기 크기 | 320 × 480 px |
| 폰트 크기 | 14px |
| 초기 위치 | 화면 자동 배치 |

### 정책
- **위치/크기 저장:** 드래그·리사이즈 후 `settings.historyPanel`에 자동 저장
- **인터랙티브 영역:** 패널 영역은 클릭스루 차단 (`data-interactive="true"`)
- **삭제:** "기록 지우기" 버튼으로 전체 삭제. 개별 삭제 미지원

---

## 20. 다국어 지원

### 기능 설명
앱의 모든 UI 텍스트를 한국어·영어로 제공한다.

### 관련 파일
- `src/i18n/index.ts`
- `src/i18n/ko.json`
- `src/i18n/en.json`

### 지원 언어

| 코드 | 언어 | 비고 |
|------|------|------|
| `ko` | 한국어 | 기본값, 폴백 |
| `en` | 영어 | |

### 정책
- **자동 감지:** 설정 없으면 `navigator.language` 기반 자동 감지. 영어계 → `en`, 그 외 → `ko`
- **번역 키 수:** ko/en 각 213개 이상. 양쪽 항상 동일하게 유지
- **폴백:** 번역 키 누락 시 `ko` 자동 대체
- **약관 본문 포함:** 이용약관·개인정보처리방침 본문도 i18n 파일(`terms.service`, `terms.privacy`)로 관리
- **동적 변수 지원:** `{{변수명}}` 보간 방식

---

## 21. 인증 (OAuth)

### 기능 설명
OAuth 2.0 기반 소셜 로그인으로 계정을 생성하고 관리한다.

### 지원 프로바이더

| 프로바이더 | 상태 |
|-----------|------|
| Google | ✅ 활성화 |
| Apple | ⏳ 향후 예정 |
| Meta (Facebook) | ⏳ 향후 예정 |
| X (Twitter) | ⏳ 향후 예정 |

### 관련 파일
- `src/components/auth/AuthScreen.tsx`
- `src/components/auth/UserProfile.tsx`
- `src/services/auth/authService.ts`
- `src/services/auth/supabaseClient.ts`
- `src/services/auth/oauthClient.ts`

### OAuth 흐름
```
로그인 버튼 클릭
  → supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })
  → Tauri invoke('open_oauth_url') → 시스템 브라우저 열림
  → 사용자 로그인 → Supabase 콜백
  → mypartnerai://auth/callback?code=... (딥링크)
  → App.tsx onOpenUrl 수신
  → invoke('parse_auth_callback')
  → supabase.auth.exchangeCodeForSession(code)
  → user + session → authStore 저장
  → profiles 테이블 자동 생성 (트리거)
```

### 저장 데이터

| 항목 | 저장 위치 |
|------|---------|
| user (id, email, nickname, provider) | `localStorage` (`mypartnerai-auth`) |
| tokens (accessToken, refreshToken, expiresAt) | `localStorage` (`mypartnerai-auth`) |
| profiles (nickname, avatar_url, provider) | Supabase 클라우드 |
| hasAgreedToTerms | `localStorage` (`mypartnerai-auth`) |

### 정책
- **Mock 모드:** `VITE_SUPABASE_URL` 미설정 시 자동으로 Mock 모드 동작 (개발·테스트용)
- **토큰 저장:** `accessToken`, `refreshToken`을 `localStorage`에 저장. 클라우드 전송 안 함
- **OAuth 타임아웃:** 브라우저에서 5분 내 완료 안 되면 자동 타임아웃
- **닉네임 연동:** OAuth 닉네임이 아바타 이름 초기값으로 자동 적용 (미설정 시에만)
- **Provider 중앙 관리:** `ENABLED_PROVIDERS` 상수(`src/services/auth/oauthClient.ts`)에서 활성 프로바이더 관리. 신규 프로바이더 등록 후 이 배열에만 추가하면 UI 전체에 반영
- **재로그인:** 로그아웃 후 재로그인 시 약관 동의 화면 건너뜀 (`hasAgreedToTerms` 유지)

---

## 22. 약관 동의

### 기능 설명
최초 로그인 전 이용약관·개인정보처리방침 동의를 받는다.

### 관련 파일
- `src/components/auth/AuthScreen.tsx`
- `src/components/auth/TermsModal.tsx`
- `src/stores/authStore.ts`

### 약관 종류

| 종류 | 내용 |
|------|------|
| 이용약관 | 목적, 서비스 설명, 수집 정보, 금지 행위, 책임 제한, 계정 해지 |
| 개인정보처리방침 | 수집 항목, 미수집 항목, 보관 위치, 보관 기간, 제3자 제공, 문의 |

### 현행 약관 버전
`2026.02` (`src/i18n/ko.json` → `terms.version`)

### 정책
- **동의 없이 로그인 불가:** 이용약관·개인정보처리방침 양쪽 모두 체크해야 로그인 버튼 활성화
- **동의 이력 저장:** `user_consents` 테이블에 `(user_id, terms_type, terms_ver, agreed_at)` 기록
- **재동의 불필요:** `hasAgreedToTerms = true`이면 재로그인 시 약관 화면 건너뜀
- **체크 해제 반영:** 동의 후 체크박스를 해제하면 `hasAgreedToTerms = false`로 스토어 즉시 반영
- **약관 본문 접근:** 로그인 화면과 프로필 상세 화면 양쪽에서 모달로 조회 가능
- **약관 버전 관리:** `terms.version` 변경 시 `user_consents`에 새 행 추가됨

---

## 23. 계정 탈퇴

### 기능 설명
모든 클라우드 데이터를 영구 삭제하고 로컬 초기화를 수행한다.

### 관련 파일
- `src/components/auth/UserProfile.tsx`
- `src/services/auth/authService.ts`
- `supabase/functions/delete-account/index.ts`

### 탈퇴 흐름
```
설정 패널 → 계정 → "계정 삭제" 버튼 클릭
  → 1단계: 경고 문구 표시 (deleteConfirm = true)
  → "영구 삭제" 버튼 클릭 (2단계 확인)
  → authService.deleteAccount(accessToken)
  → POST /functions/v1/delete-account (Bearer)
  → Edge Function: JWT 검증 → Admin.deleteUser(user.id)
  → auth.users CASCADE 삭제
      → profiles, user_settings, user_consents 자동 삭제
  → conversationStore.clearMessages()  ← 로컬 대화 기록 삭제
  → authStore.logout()                 ← 로컬 인증 상태 초기화
```

### 삭제 범위

| 데이터 | 저장 위치 | 삭제 방식 |
|--------|----------|---------|
| `auth.users` | Supabase | Edge Function Admin API |
| `profiles` | Supabase | CASCADE 즉시 삭제 |
| `user_settings` | Supabase | CASCADE 즉시 삭제 |
| `user_consents` | Supabase | CASCADE 즉시 삭제 |
| 대화 기록 | 로컬 localStorage | `clearMessages()` |
| 인증 토큰 | 로컬 localStorage | `logout()` |

### 정책
- **Hard Delete:** 탈퇴 시 모든 클라우드 데이터를 즉시 영구 삭제. Soft delete 없음
- **2단계 확인:** 실수 방지를 위해 버튼 2회 클릭 필요
- **서비스 역할 키 보호:** Admin API는 Edge Function 서버 측에서만 호출. 프론트엔드에서 Service Role Key 미노출
- **로컬 동시 삭제:** 클라우드 삭제 성공 시 로컬 데이터도 즉시 삭제
- **실패 처리:** Edge Function 호출 실패 시 에러 메시지 표시. 로컬 데이터는 삭제하지 않음 (재시도 가능하도록)
- **탈퇴 후 상태:** 로그아웃 상태로 전환. 앱 종료 불필요

---

## 부록 — 데이터 저장 정책 요약

| 데이터 | 저장 위치 | 클라우드 전송 여부 |
|--------|----------|-----------------|
| API 키 | 로컬 only | ❌ 없음 |
| 대화 내용 | 로컬 only | ❌ 없음 |
| 음성 파일 | 임시 → 삭제 | ❌ 없음 |
| 스크린샷 | 메모리 → LLM API만 전송 | ✅ LLM API만 |
| 프로필 (닉네임, 이메일) | 로컬 + Supabase | ✅ Supabase만 |
| 앱 설정 (API 키 제외) | 로컬 + Supabase | ✅ Supabase만 |
| 약관 동의 이력 | 로컬 + Supabase | ✅ Supabase만 |
| 인증 토큰 | 로컬 only | ❌ 없음 |

## 부록 — Tauri 백엔드 명령어 목록

| 명령어 | 파일 | 기능 |
|--------|------|------|
| `transcribe_audio` | voice.rs | Whisper STT 실행 |
| `check_whisper_available` | voice.rs | Whisper 설치 확인 |
| `get_whisper_availability` | voice.rs | Whisper 경로 반환 |
| `detect_remote_environment` | voice.rs | 원격 세션 감지 |
| `capture_screen` | screenshot.rs | 스크린샷 캡처 |
| `set_ignore_cursor_events` | window.rs | 클릭스루 제어 |
| `set_window_position` | window.rs | 윈도우 위치 설정 |
| `get_window_size` | window.rs | 윈도우 크기 조회 |
| `get_cursor_position` | window.rs | 마우스 위치 조회 |
| `log_to_terminal` | window.rs | 터미널 로깅 |
| `open_microphone_settings` | settings.rs | 마이크 설정 열기 |
| `open_accessibility_settings` | settings.rs | 접근성 설정 열기 |
| `open_screen_recording_settings` | settings.rs | 화면 녹화 권한 열기 |
| `pick_vrm_file` | settings.rs | VRM 파일 선택 다이얼로그 |
| `open_oauth_url` | auth.rs | OAuth URL 브라우저 열기 |
| `parse_auth_callback` | auth.rs | 딥링크 콜백 URL 파싱 |
