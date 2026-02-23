# Issue #004: Supertonic TTS ONNX 모델 로딩 실패 (Vite 번들링 문제)

[← 문서 목록으로](../../CLAUDE.md)

## 문제 요약

Supertonic TTS를 onnxruntime-web으로 통합할 때 ONNX 모델 로딩이 무한 대기 상태에 빠지는 문제

## 증상

- `ort.InferenceSession.create()` 호출 시 무한 대기 (hang)
- Promise가 resolve/reject 되지 않음
- 에러 메시지 없음, 타임아웃도 발생하지 않음
- 콘솔에 "Loading duration_predictor..." 출력 후 멈춤

## 환경

- Vite 6.0.7
- onnxruntime-web 1.23.2 (최신 버전)
- React 18 + TypeScript
- Tauri 2.0

## 원인 분석

### Vite의 의존성 최적화 문제

Vite는 개발 모드에서 ESM 모듈을 pre-bundle하여 최적화합니다. 그러나 `onnxruntime-web`은 WASM 파일과 Web Worker를 동적으로 로드하는 특수한 구조를 가지고 있어 Vite의 번들링과 충돌합니다.

### 구체적 원인

1. **WASM 파일 경로 문제**: Vite가 번들링한 ort 모듈이 WASM 파일 경로를 올바르게 찾지 못함
2. **ESM 모듈 변환 문제**: Vite가 onnxruntime-web의 ESM 모듈을 변환하면서 내부 동적 로딩 로직이 깨짐
3. **onnxruntime-web 버전**: 최신 버전(1.23.x)이 Vite와 호환성 문제 발생

## 시도한 해결책 (실패)

| 시도 | 결과 |
|-----|------|
| `ort.env.wasm.numThreads = 1` | 무한 대기 유지 |
| `ort.env.wasm.simd = false` | 무한 대기 유지 |
| `ort.env.wasm.proxy = false` | 무한 대기 유지 |
| `ort.env.wasm.init()` 명시적 호출 | 무한 대기 유지 |
| ArrayBuffer로 모델 로딩 | 무한 대기 유지 |
| `optimizeDeps.include` | 무한 대기 유지 |

## 최종 해결책

### 1. onnxruntime-web 버전 다운그레이드

```bash
npm install onnxruntime-web@1.17.0
```

공식 Supertonic 웹 데모에서 사용하는 버전으로 다운그레이드합니다.

### 2. Vite 의존성 최적화 제외

```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
});
```

### 3. Cross-Origin Isolation 헤더 추가

```typescript
// vite.config.ts
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
},
```

SharedArrayBuffer 사용을 위해 필요합니다.

### 4. WASM 파일 복사

```bash
cp node_modules/onnxruntime-web/dist/*.wasm public/
```

WASM 파일을 public 디렉토리에 복사하여 직접 접근 가능하게 합니다.

### 5. 동적 ESM Import (핵심!)

```typescript
// 기존 (문제 발생)
import * as ort from 'onnxruntime-web';

// 해결책
let ort: typeof import('onnxruntime-web') | null = null;

async function getOrt() {
  if (!ort) {
    // @ts-ignore - ESM 직접 import
    ort = await import('/node_modules/onnxruntime-web/dist/esm/ort.min.js');
    ort.env.wasm.wasmPaths = '/';
  }
  return ort;
}
```

Vite의 번들링을 우회하여 node_modules에서 ESM 모듈을 직접 동적 import합니다.

## 검증 방법

### 테스트 페이지 생성

```html
<!-- public/test-onnx.html -->
<!DOCTYPE html>
<html>
<head><title>ONNX Test</title></head>
<body>
  <div id="status">Loading...</div>
  <script type="module">
    async function test() {
      const ort = await import('/node_modules/onnxruntime-web/dist/esm/ort.min.js');
      ort.env.wasm.wasmPaths = '/';

      const session = await ort.InferenceSession.create(
        '/models/supertonic/onnx/duration_predictor.onnx',
        { executionProviders: ['wasm'] }
      );

      document.getElementById('status').textContent = 'SUCCESS!';
    }
    test();
  </script>
</body>
</html>
```

`http://localhost:1420/test-onnx.html` 접속하여 "SUCCESS!" 표시 확인

## 핵심 포인트

1. **동적 ESM import가 핵심 해결책**
   - Vite의 정적 import 번들링 우회
   - `/node_modules/...` 경로로 직접 접근

2. **onnxruntime-web@1.17.0 사용**
   - 공식 Supertonic 데모와 동일 버전
   - 최신 버전(1.23.x)은 Vite와 호환성 문제

3. **WASM 파일 경로 설정 필수**
   - `ort.env.wasm.wasmPaths = '/'`
   - WASM 파일이 public/ 루트에 있어야 함

4. **COOP/COEP 헤더 필수**
   - SharedArrayBuffer 사용을 위해 필요
   - 멀티스레드 WASM 실행에 필요

## 관련 링크

- [Supertonic GitHub](https://github.com/anthropics/supertonic)
- [Supertonic Web Demo](https://github.com/anthropics/supertonic/tree/main/demo/web)
- [onnxruntime-web npm](https://www.npmjs.com/package/onnxruntime-web)
- [Vite Dependency Pre-Bundling](https://vitejs.dev/guide/dep-pre-bundling.html)

## 환경 정보

- onnxruntime-web: 1.17.0
- Vite: 6.0.7
- React: 18.3.1
- Tauri: 2.0

## 관련 파일

- `src/services/voice/supertonicClient.ts` - Supertonic TTS 클라이언트
- `vite.config.ts` - Vite 설정 (optimizeDeps, headers)
- `public/*.wasm` - ONNX Runtime WASM 파일
- `public/models/supertonic/` - Supertonic 모델 파일
