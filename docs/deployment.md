# 배포 가이드 (macOS)

현재 배포 플로우는 다음 순서입니다.

1. 모델 준비 (`prepare-assets`)
2. 앱 빌드 (`tauri build`)
3. 모델/Whisper 런타임 스테이징 (`stage-bundled-models`)
4. 코드사인 (`sign-macos-app`)
5. 선택: 노타라이즈 (`notarize-macos-app`)

## 1) 사전 준비

### 필수

```bash
npm install
xcode-select --install
```

### 코드사인 확인

```bash
security find-identity -v -p codesigning
```

## 2) 주요 명령

### 앱 번들 생성 + 스테이징 + 서명

```bash
npm run build:mac-app
```

- 기본적으로 Whisper `base,small,medium` 번들 대상
- 결과: `src-tauri/target/release/bundle/macos/MyPartnerAI.app`

### 노타라이즈까지 포함

```bash
npm run build:mac-release
```

## 3) 관련 환경변수

### 모델 준비

```bash
export WHISPER_BUNDLE_MODELS=base,small,medium
export PREPARE_DOWNLOAD_WHISPER=1
```

### 코드사인

```bash
# Developer ID 서명
export APPLE_CODESIGN_IDENTITY="Developer ID Application: <Name> (<TEAM_ID>)"

# 미설정 시 ad-hoc(-) 서명
```

### 노타라이즈

옵션 A) keychain profile

```bash
export APPLE_NOTARY_PROFILE="<profile-name>"
```

옵션 B) Apple ID

```bash
export APPLE_ID="you@example.com"
export APPLE_TEAM_ID="TEAMID1234"
export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

## 4) 번들 포함 검증

```bash
# 모델
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/models/whisper
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/models/supertonic/onnx
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/models/supertonic/voice_styles

# whisper runtime
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/bin
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/lib
```

## 5) 자주 발생하는 배포 이슈

### "손상된 파일" / "악성코드 확인 불가"

원인:
- Developer ID 서명/노타라이즈 미완료

대응:
1. Developer ID로 재서명
2. 노타라이즈 + staple 수행
3. 새 아카이브로 재배포

### `dyld_path_missing` 또는 실행 즉시 SIGSEGV

원인:
- `.app` 구조 손상 또는 실행 파일 누락
- 잘못된 압축/전송

대응:
1. `npm run build:mac-app`으로 번들 재생성
2. `ditto -c -k --sequesterRsrc --keepParent MyPartnerAI.app MyPartnerAI.zip`로 재압축
3. 압축본 전달 후 재테스트

### Whisper CLI/모델 미탐지 팝업

원인:
- `Resources/bin` 또는 `Resources/models/whisper` 누락

대응:
1. `stage-bundled-models.mjs` 실행 여부 확인
2. 번들 내부 경로 검증 후 재빌드

### TTS Test 오류 또는 무음

원인:
- `Resources/models/supertonic` 누락/손상

대응:
1. `onnx`, `voice_styles` 폴더 존재 확인
2. 앱 완전 종료 후 재실행

## 6) 릴리즈 체크리스트

- [ ] 첫 실행 시 VRM 파일 선택 동작
- [ ] Whisper STT 동작 (`base/small/medium` 선택 가능)
- [ ] Supertonic TTS Test 동작
- [ ] 답변 시 말풍선/아바타/버튼 유지
- [ ] 우하단 기능/옵션 버튼 고정
- [ ] 단일 인스턴스 동작
