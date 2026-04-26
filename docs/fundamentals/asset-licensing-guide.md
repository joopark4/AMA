# 에셋 라이선스 가이드

> 배포/공개 시 반드시 확인해야 할 외부 에셋 라이선스 정책

## Mixamo 애니메이션 (FBX)

### 라이선스 요약

| 항목 | 내용 |
|------|------|
| 제공자 | Adobe Mixamo (mixamo.com) |
| 적용 약관 | Adobe General Terms of Use |
| 사용 범위 | 최종 프로젝트(게임/앱/영상)에 통합된 형태로만 사용 가능 |
| 비용 | 무료 (로열티 프리), 단 재배포 불가 |

### 허용되는 사용

- 앱/게임 내에 **임베딩된 형태**로 배포 (런타임 바이너리, 변환된 포맷 등)
- **상업적 프로젝트**에서 최종 결과물의 일부로 사용
- FBX를 GLB/JSON 등으로 **변환하여 자체 캐릭터에 리타겟팅** 후 앱 내 사용

### 금지되는 사용

| 금지 사항 | 설명 |
|-----------|------|
| **Standalone 재배포** | FBX/DAE 등 원본 파일을 독립적으로 배포 |
| **Asset pack 배포** | 에셋 모음으로 판매 또는 무료 배포 |
| **GitHub 공개 저장소 포함** | 누구나 FBX를 직접 다운로드 가능 = 재배포에 해당 |
| **서브라이선싱** | 제3자에게 Mixamo 에셋의 사용권 부여 (오픈소스 라이선스 적용 불가) |
| **원본 형태 공유** | 원본 FBX 파일을 그대로 공유/업로드 |

### 프로젝트 적용 규칙

1. **`motions/raw/`**, **`motions/clean/`**, **`motions/mixamo/`** 디렉터리의 Mixamo 유래 FBX 파일은 **공개 저장소에 포함하지 않음**
2. `.gitignore`에 원본 FBX 경로 등록 필수
3. 공개 배포 시 FBX 제거 후, 사용자가 직접 다운로드하도록 문서 안내 또는 온디맨드 다운로드 스크립트 제공
4. `public/motions/`의 변환된 런타임 클립(JSON)은 자체 리타겟팅 결과물이므로 프로젝트 라이선스(BSD 2-Clause) 적용 가능

### 배포 체크리스트

배포 전 아래 항목을 확인:

- [ ] `motions/raw/` 내 Mixamo FBX 파일이 배포 대상에 포함되지 않는가
- [ ] `motions/clean/` 내 Mixamo 유래 FBX가 배포 대상에 포함되지 않는가
- [ ] `public/motions/mixamo/` 내 원본 FBX가 배포 대상에 포함되지 않는가
- [ ] `.gitignore`에 Mixamo FBX 경로가 등록되어 있는가
- [ ] 배포용 브랜치에서 `git ls-files | grep -i mixamo | grep -i fbx`로 포함된 FBX가 없는지 확인

### 대안 에셋 (오픈 라이선스)

공개 배포가 필요한 경우 아래 대안 사용:

| 소스 | 라이선스 | 설명 |
|------|---------|------|
| CMU Motion Capture Database | CC0 (퍼블릭 도메인) | 대규모 모션 캡처 데이터 |
| Kenney Animated Characters | CC0 | 캐릭터 + 애니메이션 |
| Blender Motion Library | CC-BY | Blender 자체 모션 |
| 자체 제작 | 프로젝트 라이선스 | Blender 등으로 직접 제작 |

---

## VRM 모델

### 라이선스 요약

- VRM 파일은 **모델별로 라이선스가 다름** (각 모델의 메타데이터 확인 필요)
- VRM 사양 자체는 오픈 표준
- 프로젝트 기본 VRM(`assets/default.vrm`)은 자체 에셋으로 프로젝트 라이선스 적용

### 프로젝트 적용 규칙

1. 기본 VRM은 AES-128-GCM 암호화하여 번들에 포함 (casual extraction 방지)
2. 사용자 업로드 VRM은 로컬에만 저장, 서버/저장소에 업로드하지 않음

---

## Whisper / Supertonic 모델

| 모델 | 라이선스 | 배포 |
|------|---------|------|
| Whisper (OpenAI) | MIT | 자유 배포 가능 |
| Supertonic TTS | 프로젝트 전용 | 온디맨드 다운로드 (번들 포함 가능) |

---

## 참고 링크

- [Adobe General Terms of Use](https://www.adobe.com/legal/terms.html)
- [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo.html)
- [CMU Motion Capture Database](http://mocap.cs.cmu.edu/)
- [VRM 사양](https://vrm.dev/)
