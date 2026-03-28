# Mixamo 커스텀 모션 제작 및 AMA 추가 가이드

> AMA 아바타에 새로운 동작을 추가하는 5가지 방법과 단계별 구현 지침

## 개요

AMA는 VRM 아바타의 애니메이션으로 Mixamo 기반 모션을 사용합니다. 커스텀 모션을 만드는 방법은 5가지입니다:

1. **Blender에서 직접 제작** — 가장 유연하고 강력한 방법
2. **Mixamo 기존 모션 커스터마이징** — 기존 모션을 다운로드 후 편집
3. **모션 캡처 (웹캠/동영상)** — AI 기반 자동 추출
4. **AI 텍스트 기반 생성** — 텍스트 설명으로 모션 생성
5. **Mixamo에서 직접 다운로드** — Mixamo 라이브러리 활용

---

## 방법 1: Blender에서 직접 제작

Blender를 사용한 애니메이션 제작이 가장 자유도가 높습니다.

### 1.1 준비물

- **Blender 4.0+** (무료, https://www.blender.org)
- **Mixamo 애드온** (Blender 공식 마켓플레이스)
- **VRM 캐릭터 모델** (또는 Mixamo 기본 캐릭터)

### 1.2 단계

#### Step 1: Blender 프로젝트 설정

```bash
# 새 Blender 프로젝트 생성
1. Blender 실행
2. General 템플릿 선택
3. Edit > Preferences > Add-ons
4. "Mixamo Rig" 검색 후 설치 및 활성화
```

#### Step 2: 캐릭터 임포트

**옵션 A: Mixamo 캐릭터 사용**
```
1. Mixamo.com 접속 (Adobe 계정 필요)
2. Characters 탭 > 원하는 캐릭터 선택
3. Download 클릭 > Format: FBX, Pose: T-Pose 선택
4. Blender: File > Import > FBX로 FBX 파일 임포트
5. 임포트 후: 아머처 선택 > N 키 > Mixamo 탭 > Create Control Rig 클릭
```

**옵션 B: VRM 캐릭터 사용**
```
1. VRM 파일 준비 (AMA의 기본 VRM 또는 커스텀)
2. Blender: 추가 > Mesh > Import VRM (VRM 애드온 필요)
3. VRM 임포트 완료
```

#### Step 3: 애니메이션 제작

```
1. Timeline 창에서 애니메이션 편집
2. Pose Mode (Ctrl+Tab)로 전환
3. 키프레임 삽입 (I 키):
   - 초기 포즈 설정
   - 프레임 이동 (마우스 휠로 타임라인 조정)
   - 다음 포즈 설정
   - 반복하여 애니메이션 만들기
4. NLA Editor에서 애니메이션 정리 (여러 동작 결합)
```

**좋은 애니메이션 팁:**
- 30 FPS 기준으로 작업 (AMA 표준)
- 0.5초 ~ 3초 길이 추천
- 루프 가능한 동작이면 마지막 프레임을 초기 포즈와 맞추기
- Dope Sheet에서 자연스러운 움직임 곡선 조정

#### Step 4: 익스포트

```
File > Export > FBX 선택
```

**익스포트 설정 (중요):**
```
- Format: Blender
- Animation: ✓ (체크)
- Group by NLA Track: ✓
- NLA Strips: ✓
- Scale: 1.00
- Forward: -Y Forward
- Up: Z Up
```

**파일명 규칙:**
```
motion_[emotion]_[number].fbx
예: motion_happy_01.fbx, motion_sad_02.fbx
```

---

## 방법 2: Mixamo 모션 커스터마이징

기존 Mixamo 모션을 다운로드하여 원하는 대로 편집합니다.

### 2.1 단계

#### Step 1: Mixamo에서 모션 다운로드

```
1. Mixamo.com 접속
2. Animations 탭 > 원하는 모션 검색
3. 모션 선택 > 캐릭터 적용 (필수)
4. Download 클릭
   - Format: FBX
   - Skin: Without Skin
   - Framerate: 30
   (또는 원하는 프레임레이트)
```

#### Step 2: Blender에서 임포트 및 편집

```bash
# Blender에서
1. File > Import > FBX로 다운로드한 FBX 임포트
2. 아머처 선택 > N > Mixamo 탭 > Create Control Rig
3. Pose Mode에서 필요한 프레임 선택해서 편집:
   - 손 위치 조정
   - 몸통 각도 수정
   - 표정 등 미세 조정
```

**NLA Editor 활용:**
```
1. NLA Editor 열기 (스페이스바 > NLA Editor)
2. 여러 모션 결합:
   - 클립 순서 변경
   - 클립 사이 트랜지션 조정
   - 길이 수정 (드래그하여 조정)
```

#### Step 3: 베이킹 및 익스포트

모션 레이어를 최종 키프레임으로 베이킹:
```
1. 애니메이션 선택
2. NLA Editor에서: Push Down Action 클릭
3. Dope Sheet에서 완성된 키프레임 확인
4. File > Export > FBX로 익스포트
```

---

## 방법 3: 모션 캡처 (웹캠/동영상)

AI 기반 모션 캡처 도구를 사용하여 웹캠이나 동영상에서 모션 추출.

### 3.1 추천 도구 비교

| 도구 | 무료 | 난이도 | 결과물 |
|------|------|--------|--------|
| **Plask** | 무료 | ★☆☆ | FBX, GLB |
| **DeepMotion** | 월 1-2개 | ★★☆ | FBX, BVH |
| **Rokoko Vision** | 무료 | ★☆☆ | FBX, GLB |

### 3.2 Plask 사용법 (추천 - 가장 간단)

**Step 1: 비디오 준비**
```
1. Plask.ai 접속
2. 동영상 또는 웹캠으로 자신의 움직임 녹화
   (세로 영상, 전신이 보이도록)
```

**Step 2: 모션 캡처**
```
1. 비디오 업로드
2. Plask가 자동으로 골격 감지 및 모션 추출
3. 결과 미리보기
```

**Step 3: 모션 적용 및 익스포트**
```
1. Upload Character에서 VRM 또는 Mixamo 모델 업로드
2. 자동으로 리매핑 (리깅)
3. Export > FBX 선택
```

### 3.3 DeepMotion 사용법

```
1. https://www.deepmotion.com 접속
2. Upload Video (.MP4, .MOV, .AVI)
3. 자동 모션 추출 대기 (보통 수 분)
4. Export > FBX 또는 BVH 선택
5. Blender에서 임포트 후 조정 가능
```

### 3.4 Rokoko Vision 사용법

```
1. https://www.rokoko.com/products/vision 접속
2. 브라우저에서 웹캠 사용
3. Select Skeleton: Mixamo 선택
4. 움직임 녹화
5. FBX 다운로드
```

---

## 방법 4: AI 텍스트 기반 생성

텍스트 설명으로 모션 자동 생성.

### 4.1 추천 도구

| 도구 | 가격 | 출력 | 설명 |
|------|------|------|------|
| **HY-Motion** (Tencent) | 무료 | FBX, BVH, GLTF | Text-to-3D Motion |
| **SayMotion** (DeepMotion) | 무료 | FBX, GLB, BVH | 캐릭터 선택 후 생성 |
| **Vmotionize** | 무료 | FBX, GLB | 간단한 인터페이스 |

### 4.2 SayMotion 사용법 (추천)

**Step 1: 프롬프트 작성**
```
예시:
- "happy dance with arm movements"
- "sad, slouched posture with head down"
- "thinking pose, hand on chin"
- "stretching arms upward, relaxed"
```

**Step 2: 모션 생성**
```
1. https://www.deepmotion.com/saymotion 접속
2. Text 입력 (위의 예시처럼)
3. Character 선택 (Mixamo 호환 캐릭터)
4. Generate 클릭
5. 렌더링 대기 (수 초 ~ 수십 초)
```

**Step 3: 익스포트**
```
1. 생성된 모션 미리보기
2. Download > FBX 선택
3. Blender에서 임포트 및 조정 가능
```

### 4.3 HY-Motion 사용법

```
1. https://hy-motion.ai 접속
2. Text Prompt 입력 (영어):
   "happy jumping motion"
   "sad walking with slumped shoulders"
3. Generate 클릭
4. FBX/BVH/GLTF 다운로드
5. Blender 임포트 후 리깅 필요할 수 있음
```

---

## 방법 5: Mixamo 라이브러리 직접 사용

Mixamo에서 기존 모션을 바로 다운로드하여 사용.

### 5.1 단계

```
1. Mixamo.com 접속 (무료 Adobe 계정 필요)
2. Animations 탭
3. 원하는 모션 검색 (emotion, action 키워드)
4. 모션 미리보기
5. Download:
   - Format: FBX
   - Skin: Without Skin (VRM 적용 시)
   - Framerate: 30
```

### 5.2 좋은 Mixamo 모션 찾기

**감정별 추천 모션:**

| 감정 | 키워드 |
|------|--------|
| **Happy** | dance, jump, clap, cheer, excited |
| **Sad** | cry, slouch, walk_sad, depressed |
| **Angry** | punch, stomp, gesture_angry, agitated |
| **Surprised** | react_surprised, jump_surprised, gasped |
| **Relaxed** | idle, lean_back, stretch, yawn |
| **Thinking** | idle_thinking, gesture_confused, head_scratch |
| **Neutral** | walk, stand, casual_idle, gesture_ok |

---

## AMA 프로젝트에 모션 추가하기

완성된 FBX 파일을 AMA에 통합하는 방법.

### 단계 1: 모션 파일 준비

**파일명 규칙:**
```
motion_[emotion]_[number].fbx

예시:
- motion_happy_01.fbx
- motion_happy_02.fbx
- motion_sad_01.fbx
- motion_angry_01.fbx
- motion_surprised_01.fbx
- motion_relaxed_01.fbx
- motion_thinking_01.fbx
- motion_neutral_01.fbx
- motion_bridge_01.fbx (전환 모션)
```

**요구사항:**
- 포맷: FBX (Blender 호환)
- 프레임레이트: 30 FPS
- 길이: 0.5초 ~ 3초
- 아머처: Mixamo 호환 리깅

### 단계 2: 모션 메타데이터 등록

`motions/clean/catalog.json` 파일에 메타데이터 추가:

```json
{
  "clips": [
    {
      "id": "motion_happy_13",
      "file": "clips/motion_happy_13.json",
      "emotion_tags": ["happy"],
      "intensity": "mid",
      "duration_ms": 2000,
      "loopable": true,
      "speaking_compatible": true,
      "priority": 5,
      "cooldown_ms": 100,
      "license_class": "custom_made",
      "source_url": "custom",
      "attribution_required": false,
      "redistribution_note": "Internal custom animation"
    }
  ]
}
```

**필드 설명:**

| 필드 | 값 | 설명 |
|------|-----|------|
| `id` | `motion_[emotion]_[number]` | 고유 ID |
| `file` | `clips/motion_*.json` | 모션 클립 경로 |
| `emotion_tags` | happy, sad, angry, ... | 감정 태그 (필수) |
| `intensity` | low, mid, high | 움직임 강도 |
| `duration_ms` | 500-3000 | 지속시간 (밀리초) |
| `loopable` | true/false | 반복 재생 가능 여부 |
| `speaking_compatible` | true/false | 대화 중 사용 가능 |
| `priority` | 1-10 | 선택 우선순위 |
| `cooldown_ms` | 100-500 | 재사용 대기시간 |
| `license_class` | custom_made, cc0, mit, ... | 라이선스 |
| `source_url` | 원본 URL 또는 "custom" | 출처 |
| `attribution_required` | true/false | 저작자 표시 필요 |
| `redistribution_note` | 설명 | 재배포 조건 |

### 단계 3: 모션 클립 JSON 생성

각 모션마다 `motions/clean/clips/motion_*.json` 파일 생성:

```json
{
  "id": "motion_happy_13",
  "file_path": "../raw/motion_happy_13.fbx",
  "emotion_tags": ["happy"],
  "intensity": "mid",
  "duration_ms": 2000,
  "loopable": true,
  "speaking_compatible": true,
  "priority": 5,
  "cooldown_ms": 100,
  "fps": 30,
  "frame_count": 60,
  "description": "Happy pose with arm movement",
  "license_class": "custom_made",
  "source_url": "custom",
  "attribution_required": false,
  "redistribution_note": "Internal custom animation",
  "creator": "Your Name",
  "created_date": "2026-03-26",
  "validated": true
}
```

### 단계 4: 빌드 및 테스트

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run tauri dev

# 또는 전체 빌드
npm run build
```

**테스트 체크리스트:**
```
- [ ] 모션 로드 성공 (메모리 에러 없음)
- [ ] 아바타가 모션 실행 (부자연스러움 없음)
- [ ] 모션 길이 적절 (너무 길거나 짧지 않음)
- [ ] 루프 모션이 부드럽게 반복
- [ ] 감정 태그가 올바르게 선택됨
```

---

## 성능 및 호환성 체크리스트

### 모션 파일 검증

```typescript
// motionLibrary.ts에서 자동 검증됨
- ✓ 파일 존재 여부
- ✓ 필수 메타데이터 완성도
- ✓ 감정 태그 유효성
- ✓ 강도(intensity) 값 (low/mid/high)
- ✓ 총 클립 수 (최소 24개)
- ✓ 감정별 최소 클립 수 (각 3개 이상)
```

### 파일 크기 가이드

| 항목 | 가이드 |
|------|--------|
| FBX 파일 | 1~5 MB |
| JSON 메타 | < 1 KB |
| 프레임 수 | 15~90 (0.5~3초 @ 30fps) |

### VRM 호환성

- **Mixamo 리깅** ✓ (권장)
- **Standard Human IK** ✓
- **Mecanim** ✓ (Unity 호환)

---

## 문제 해결

### 모션이 로드되지 않음

```
1. motions/clean/catalog.json 검증:
   - JSON 문법 확인
   - 모든 필드 존재 여부
   - file 경로 정확성

2. 파일 존재 확인:
   - motions/clean/clips/motion_*.json 존재
   - motions/raw/ 또는 dist/motions/ 에 FBX 파일

3. 브라우저 콘솔 에러 확인:
   - DevTools (F12) > Console 탭
   - motionLibrary.ts 로그 메시지
```

### 아바타 모션이 부자연스러움

```
1. Blender에서 다시 확인:
   - IK (Inverse Kinematics) 설정 확인
   - 키프레임 곡선 부드럽게 조정
   - 손/발 위치 미세 조정

2. 메타데이터 재검토:
   - intensity 값이 의도와 맞는지
   - duration_ms 재계산 (프레임 수 / 30 * 1000)
```

### Mixamo 임포트 실패

```
1. FBX 형식 확인:
   - Blender 4.0+ 호환 확인
   - Scale 설정: 1.00

2. 아머처 설정:
   - "Create Control Rig" 클릭 확인
   - Mixamo Rig 애드온 활성화 확인
```

---

## 추가 자료

### 공식 문서
- [Mixamo Help](https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html)
- [Blender Manual](https://docs.blender.org/manual/en/latest/)
- [FBX Format Specs](https://www.autodesk.com/developer/openprojects/fbx)

### 커뮤니티 자료
- [Blender Mocap 튜토리얼](https://www.youtube.com/watch?v=motion-capture-blender)
- [Plask AI 가이드](https://plask.ai/en-US/docs)
- [AMA 아바타 시스템 문서](./avatar-system.md)

### 라이선스 정보
- **Mixamo**: [무료 사용 라이선스](https://www.adobe.com/products/mixamo.html) (상업용 가능)
- **Blender**: GPL (무료, 오픈소스)
- **Plask**: 무료 및 유료 플랜
- **DeepMotion**: 무료 및 유료 플랜

---

## 요약

| 방법 | 난이도 | 소요시간 | 결과 | 추천 |
|------|--------|----------|------|------|
| **Blender 직접 제작** | ★★★ | 1-2시간 | 매우 자유로움 | 완벽한 커스터마이징 필요할 때 |
| **Mixamo 커스터마이징** | ★★☆ | 30분-1시간 | 좋음 | 기존 모션 다듬기 |
| **모션 캡처** | ★☆☆ | 10-20분 | 자연스러움 | 자신의 움직임 캡처 |
| **AI 생성** | ★☆☆ | 5-10분 | 빠르고 다양 | 빠른 프로토타입 |
| **Mixamo 다운로드** | ★☆☆ | 1-5분 | 안정적 | 기본 모션 추가 |

**추천 접근:**
1. **신규 감정 추가** → AI 생성 + Blender 미세 조정
2. **표현력 높이기** → 모션 캡처
3. **완벽함 추구** → Blender 직접 제작
4. **빠른 확장** → Mixamo 라이브러리 활용
