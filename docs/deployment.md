# 배포 가이드 (macOS)

최신 배포 파이프라인은 모델 번들링 + 코드사인 + (선택) 노타라이즈를 포함합니다.

## 1. 사전 준비

### 필수 도구

```bash
xcode-select --install
npm install
```

### Apple 개발자 정보

- Developer ID Application 인증서
- Team ID
- (노타라이즈 시) notarytool 인증 정보

인증서 확인:

```bash
security find-identity -v -p codesigning
```

## 2. 주요 스크립트

- `npm run build:mac-app`
  - Whisper 모델(base/small/medium) 준비
  - Tauri app 번들 생성
  - 모델/Whisper 런타임을 app Resources로 스테이징
  - 코드사인(`scripts/sign-macos-app.mjs`)

- `npm run build:mac-release`
  - `build:mac-app` 실행
  - 노타라이즈 + staple(`scripts/notarize-macos-app.mjs`)

## 3. 환경 변수

### 모델 준비

```bash
export WHISPER_BUNDLE_MODELS=base,small,medium
export PREPARE_DOWNLOAD_WHISPER=1
```

### 코드사인

```bash
# Developer ID로 서명
export APPLE_CODESIGN_IDENTITY="Developer ID Application: <Your Name> (<TEAM_ID>)"

# 미지정 시 ad-hoc(-) 서명
```

### 노타라이즈 (둘 중 하나)

옵션 A: keychain profile

```bash
export APPLE_NOTARY_PROFILE="notarytool-profile-name"
```

옵션 B: Apple ID 자격증명

```bash
export APPLE_ID="you@example.com"
export APPLE_TEAM_ID="TEAMID1234"
export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

## 4. 빌드 절차

### 로컬 테스트용(빠른)

```bash
npm run build:mac-app
```

출력:
- `src-tauri/target/release/bundle/macos/MyPartnerAI.app`

### 배포용

```bash
npm run build:mac-release
```

## 5. 번들 포함 항목 검증

```bash
# 모델
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/models/whisper
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/models/supertonic/onnx
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/models/supertonic/voice_styles

# whisper runtime
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/bin
ls src-tauri/target/release/bundle/macos/MyPartnerAI.app/Contents/Resources/lib
```

## 6. Gatekeeper/실행 이슈 대응

### "손상된 파일" / "악성코드 확인 불가"

원인:
- 미서명/부적절 서명
- 노타라이즈 미완료

대응:
1. Developer ID로 재서명
2. 노타라이즈 + staple 수행
3. `.app` 재배포

### `dyld_path_missing` / 실행 즉시 크래시

원인:
- 앱 번들 손상, 잘못된 압축/전송, 실행 파일 누락

대응:
1. `build:mac-app`로 번들을 새로 생성
2. `ditto -c -k --sequesterRsrc --keepParent`로 압축
3. 압축본으로 재배포

## 7. 배포 체크리스트

- [ ] 앱 첫 실행 시 VRM 파일 선택 가능
- [ ] Whisper STT 동작(모델 선택 base/small/medium)
- [ ] Supertonic TTS Test 동작
- [ ] 음성 입력 버튼/설정 버튼 우하단 고정
- [ ] 원격 세션에서 STT 차단 메시지 표시
- [ ] 단일 인스턴스 동작 확인
