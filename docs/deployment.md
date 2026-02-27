# 배포 가이드 (macOS)

> 최종 수정: 2026-02-27 (v0.4.2 기준)
> 대상 플랫폼: macOS Apple Silicon (`darwin-aarch64`)

## 배포 방법

### A. 통합 배포 스크립트 (권장)

`release-local.mjs`를 사용하면 빌드부터 GitHub Release/Pages 배포까지 전체 파이프라인을 자동 실행합니다.

```bash
# 전체 배포
npm run release:local

# 로컬 검증만 (GitHub 업로드 없이)
node scripts/release-local.mjs --skip-release --skip-pages

# 빌드 생략 (이미 빌드된 상태에서 재패키징)
node scripts/release-local.mjs --skip-build

# 노타라이즈 생략
node scripts/release-local.mjs --skip-notarize

# 미리보기 (아무 동작 안 함)
node scripts/release-local.mjs --dry-run
```

#### 파이프라인 단계

| 단계 | 설명 | 스킵 플래그 |
|------|------|-------------|
| 1. PRE-CHECK | 환경변수, 도구, 버전 동기화, git 상태 확인 | — |
| 2. BUILD | `npm run tauri build -- --bundles app` | `--skip-build` |
| 3. STAGE | Whisper runtime + 모델 스테이징 | — |
| 4. SIGN | Developer ID 코드사인 | — |
| 5. NOTARIZE | Apple 노타라이즈 + staple | `--skip-notarize` |
| 6. PACKAGE | tar.gz + updater sig + DMG 생성 | — |
| 7. GITHUB RELEASE | `gh release create` + DMG 업로드 | `--skip-release` |
| 8. GITHUB PAGES | latest.json + tar.gz 업데이터 아티팩트 | `--skip-pages` |

#### 버전 동기화

`release-local.mjs`의 PRE-CHECK 단계에서 `package.json` 버전을 기준으로 `Cargo.toml`과 `tauri.conf.json`을 자동 동기화합니다. 별도 수동 작업 불필요.

### B. 단계별 수동 배포

```bash
# 1. 앱 번들 생성 + 스테이징 + 서명
npm run build:mac-app

# 2. 노타라이즈까지 포함
npm run build:mac-release
```

- 기본적으로 Whisper `base,small,medium` 번들 대상
- 결과: `src-tauri/target/release/bundle/macos/AMA.app`

## 사전 준비

### 필수

```bash
npm install
xcode-select --install
```

### 코드사인 확인

```bash
security find-identity -v -p codesigning
```

## 환경변수

### 코드사인

```bash
# Developer ID 서명 (필수)
export APPLE_CODESIGN_IDENTITY="Developer ID Application: <Name> (<TEAM_ID>)"
```

### 노타라이즈

옵션 A) keychain profile (권장)

```bash
export APPLE_NOTARY_PROFILE="<profile-name>"
```

옵션 B) Apple ID

```bash
export APPLE_ID="you@example.com"
export APPLE_TEAM_ID="TEAMID1234"
export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

### 업데이터 서명

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/mypartnerai.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<password>"
```

### 모델 준비

```bash
export WHISPER_BUNDLE_MODELS=base,small,medium
export PREPARE_DOWNLOAD_WHISPER=1
```

## 번들 포함 검증

```bash
# 모델
ls src-tauri/target/release/bundle/macos/AMA.app/Contents/Resources/models/whisper
ls src-tauri/target/release/bundle/macos/AMA.app/Contents/Resources/models/supertonic/onnx
ls src-tauri/target/release/bundle/macos/AMA.app/Contents/Resources/models/supertonic/voice_styles

# whisper runtime
ls src-tauri/target/release/bundle/macos/AMA.app/Contents/Resources/bin
ls src-tauri/target/release/bundle/macos/AMA.app/Contents/Resources/lib
```

## 업데이터 인프라

### 엔드포인트

- GitHub Pages: `https://joopark4.github.io/apps/ama/`
- `latest.json`: 최신 버전 정보 + 서명 + 다운로드 URL
- `AMA.app.tar.gz`: 업데이트용 아카이브
- `AMA.app.tar.gz.sig`: 업데이터 서명

### latest.json 구조

```json
{
  "version": "v0.4.2",
  "notes": "AMA v0.4.2 release",
  "pub_date": "2026-02-27T...",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<base64 sig>",
      "url": "https://joopark4.github.io/apps/ama/AMA.app.tar.gz"
    }
  }
}
```

### 플랫폼 정책

- **Apple Silicon only**: `darwin-aarch64` 단일 플랫폼
- Intel Mac (`darwin-x86_64`)은 지원하지 않음

## 자주 발생하는 배포 이슈

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
2. `ditto -c -k --sequesterRsrc --keepParent AMA.app AMA.zip`로 재압축
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

### 업데이터 설치 시 `._AMA.app` unpack 실패

원인:
- macOS `tar`가 리소스 포크(`._*`)를 아카이브에 포함
- Tauri 업데이터가 `._` 파일을 디렉토리로 생성 시도하여 실패

대응:
1. tar 생성 시 `COPYFILE_DISABLE=1` 환경변수 필수 적용
2. `release-local.mjs`가 자동 검증 수행 (리소스 포크 감지 시 빌드 중단)
3. 수동 검증: `tar -tzf AMA.app.tar.gz | grep '\._'` → 결과 없어야 정상
4. 관련 이슈: [#011 업데이터 리소스 포크](issues/011-updater-resource-fork.md)

## 릴리즈 체크리스트

- [ ] 첫 실행 시 VRM 파일 선택 동작
- [ ] Whisper STT 동작 (`base/small/medium` 선택 가능)
- [ ] Supertonic TTS Test 동작
- [ ] 답변 시 말풍선/아바타/버튼 유지
- [ ] 우하단 기능/옵션 버튼 고정
- [ ] 단일 인스턴스 동작
- [ ] macOS 메뉴바 동작 (About / Check for Updates / Settings)
- [ ] 자동 업데이트 확인 (latest.json 버전/서명 일치)
- [ ] tar.gz 리소스 포크 미포함 확인 (`tar -tzf ... | grep '\._'` → 결과 없음)
- [ ] DMG 설치 테스트 (Applications 폴더 복사 → 실행)

## 배포 이력

| 버전 | 날짜 | 주요 내용 |
|------|------|-----------|
| v0.4.2 | 2026.02.27 | 업데이터 리소스 포크 수정, Silicon only 정책, 릴리즈 스크립트 개선 |
| v0.4.1 | 2026.02.27 | 서명 키 갱신 후 재배포 (업데이터 설치 실패 발견 → v0.4.2에서 수정) |
| v0.4.0 | 2026.02.26 | 프로덕션 빌드 안정화, 자동 업데이트, 커스텀 About, 모델 온디맨드 다운로드 |
