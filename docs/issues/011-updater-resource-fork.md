# #011 업데이터 tar.gz 리소스 포크 파일 포함

## 상태: 해결됨 (2026-02-27)

## 증상

- 설정 패널에서 업데이트 확인 → 새 버전 감지 성공
- "업데이트" 버튼 클릭 시 다운로드 후 설치 실패
- 에러 메시지: `failed to unpack ._AMA.app into /var/folders/...`

## 원인

macOS의 `tar` 명령은 기본적으로 파일의 extended attributes(리소스 포크)를 `._` 접두사 파일로 아카이브에 포함합니다.

`release-local.mjs`의 PACKAGE 단계에서 `tar -czf` 실행 시 `COPYFILE_DISABLE=1` 환경변수가 누락되어, 생성된 `AMA.app.tar.gz`에 다음과 같은 리소스 포크 파일이 포함되었습니다:

```
AMA.app/Contents/Resources/lib/._libggml-cpu.0.dylib
AMA.app/Contents/Resources/lib/._libggml-metal.0.dylib
AMA.app/Contents/Resources/lib/._libggml-base.0.9.5.dylib
AMA.app/Contents/Resources/lib/._libggml-blas.0.dylib
AMA.app/Contents/Resources/lib/._libggml-metal.dylib
AMA.app/Contents/Resources/lib/._libggml-cpu.0.9.5.dylib
```

Tauri 업데이터(`tauri-plugin-updater`)는 tar.gz를 순차적으로 unpack하면서 `._AMA.app` 엔트리를 만나면 이를 디렉토리로 생성하려다 실패합니다.

### 참고

`package.json`의 `tauri` 스크립트에는 이미 `COPYFILE_DISABLE=1`이 설정되어 있어 빌드 단계에서는 문제가 없었으나, 별도로 작성된 `release-local.mjs`의 tar 명령에는 적용되지 않았습니다.

```json
"tauri": "COPYFILE_DISABLE=1 CARGO_TARGET_DIR=$HOME/Library/Caches/mypartnerai-build tauri"
```

## 수정 내용

### 1. tar 명령에 `COPYFILE_DISABLE=1` 추가

`scripts/release-local.mjs` — PACKAGE 단계:

```diff
- run('tar', ['-czf', tarGzPath, '-C', bundleMacosDir, basename(appPath)]);
+ run('tar', ['-czf', tarGzPath, '-C', bundleMacosDir, basename(appPath)], {
+   env: { COPYFILE_DISABLE: '1' },
+ });
```

### 2. tar.gz 검증 단계 추가

tar.gz 생성 직후 `._` 파일이 포함되어 있는지 자동 검증하는 단계를 추가하여, 문제 발생 시 빌드를 즉시 중단합니다.

## 영향 범위

| 버전 | 영향 |
|------|------|
| v0.4.0 | 서명 키 불일치로 업데이트 불가 (별도 이슈) |
| v0.4.1 | 업데이트 다운로드 후 설치 실패 (`._AMA.app` 에러) |
| v0.4.2 | 수정 후 재배포 완료 — 정상 동작 |

## 검증

1. `tar -tzf AMA.app.tar.gz | grep '\._'` → 결과 없음 확인
2. v0.4.1 앱에서 v0.4.2 업데이트 확인 → 다운로드 → 설치 → 재시작 정상 동작

## 관련

- [배포 가이드](../deployment.md)
- `scripts/release-local.mjs` — PACKAGE 단계
