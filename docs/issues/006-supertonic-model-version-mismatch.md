# Issue #006: Supertonic TTS 한국어 음성 출력 안됨 (모델 버전 불일치)

[← 문서 목록으로](../../CLAUDE.md)

## 문제 요약

Supertonic TTS가 한국어 텍스트를 처리할 때 노이즈만 출력되거나 처음 몇 글자만 읽히는 문제. 비프음(테스트 사운드)은 정상 재생됨.

## 증상

- TTS 오디오가 재생되지만 노이즈/잡음만 들림
- 텍스트의 처음 몇 글자만 읽히고 나머지는 잡음
- 테스트 비프음(440Hz)은 정상 재생
- Vocoder 출력이 비정상적으로 작음 (max 0.004, 정상: 0.5-1.0)

## 로그 분석

```
[Supertonic] Vocoder input (latent): {"shape":[1,144,81],"min":-3.34,"max":3.18,"mean":-0.0007}
[Supertonic] Vocoder output length: 248832
[Supertonic] Raw audio stats: {"min":"-0.0048","max":"0.0028","maxAbs":"0.0048","rms":"0.0017"}
[Supertonic] Warning: Audio level too low, possible model issue
```

- Vocoder 입력(latent)은 정상 범위
- Vocoder 출력이 비정상적으로 작음 (0.004 vs 정상 0.5-1.0)
- 게인 증폭 시 노이즈만 증가

## 환경

- Supertonic 모델: v1.5.0 (영어 전용)
- onnxruntime-web: 1.17.0
- Vite 6.0.7 + Tauri 2.0

## 원인 분석

### 모델 버전 불일치

코드/폴더 정리 과정에서 Supertonic 모델이 v1.5.0 (영어 전용)으로 설치되어 있었으나, 한국어 TTS를 사용하려면 v1.6.0 (다국어 지원)이 필요함.

### 구체적 원인

| 모델 | v1.5.0 (영어) | v1.6.0 (다국어) |
|------|---------------|-----------------|
| `duration_predictor.onnx` | 영어 전용 | 다국어 지원 |
| `text_encoder.onnx` | 영어 전용 | 다국어 지원 |
| `vector_estimator.onnx` | 영어 전용 | 다국어 지원 |
| `vocoder.onnx` | 동일 | 동일 |

- v1.5.0의 `text_encoder`는 한국어 텍스트를 제대로 인코딩하지 못함
- 잘못된 latent 표현이 `vector_estimator`를 거쳐 vocoder로 전달
- Vocoder가 거의 무음에 가까운 출력(0.004)을 생성
- 이를 증폭하면 노이즈만 커짐

### MD5 해시 비교

**v1.5.0 (문제 발생):**
```
duration_predictor.onnx: 3dcddc08bcaccf07d0da457df9a4503b
text_encoder.onnx: 74b9be4f266c4ce643d214bdff9c9f2f
vector_estimator.onnx: 1b5e4eb3dbd99aee69c590d92b665937
vocoder.onnx: af96719abfc5343bbe2346f30c715c8c
```

**v1.6.0 (정상):**
```
duration_predictor.onnx: 17340b4e708acf4861774d8e12283745
text_encoder.onnx: 437030b90996c946f52521534931c892
vector_estimator.onnx: 052b9cdbe0ac851454f2dce4896e8523
vocoder.onnx: af96719abfc5343bbe2346f30c715c8c  # 동일
```

## 해결책

### 1. Supertonic v1.6.0 모델 다운로드

```bash
cd /tmp
git clone --depth 1 https://huggingface.co/Supertone/supertonic-2 supertonic-2-models
cd supertonic-2-models
git lfs pull
```

### 2. 모델 파일 복사

```bash
# ONNX 모델
cp /tmp/supertonic-2-models/onnx/*.onnx public/models/supertonic/onnx/
cp /tmp/supertonic-2-models/onnx/tts.json public/models/supertonic/onnx/
cp /tmp/supertonic-2-models/onnx/unicode_indexer.json public/models/supertonic/onnx/

# 음성 스타일
cp /tmp/supertonic-2-models/voice_styles/*.json public/models/supertonic/voice_styles/
```

### 3. 불필요한 오디오 증폭 코드 제거

```typescript
// 수정 전 (workaround)
let wav: number[];
if (maxAbs > 0.01) {
  const targetLevel = 0.8;
  const rawGain = targetLevel / maxAbs;
  const gain = Math.min(rawGain, 10.0);
  wav = rawWav.map(v => v * gain);
} else {
  wav = rawWav.map(v => v * 10); // 노이즈 증폭
}

// 수정 후 (원본 사용)
const wav = Array.from(wavOutput.data as Float32Array);
```

## 검증 방법

1. 앱 실행: `npm run tauri dev`
2. 한국어 메시지 전송 (예: "안녕")
3. TTS 오디오가 명확하게 재생되는지 확인
4. 로그에서 Audio stats 확인:
   ```
   [Supertonic] Audio stats: maxAbs: 0.5xxx  # 0.3-0.8 범위가 정상
   ```

## 핵심 포인트

1. **모델 버전 확인 필수**
   - 한국어 TTS: v1.6.0 (supertonic-2) 필요
   - 영어만 사용: v1.5.0도 가능

2. **HuggingFace에서 모델 다운로드**
   - GitHub 레포에는 모델 파일 없음
   - `https://huggingface.co/Supertone/supertonic-2`에서 다운로드

3. **Git LFS 필수**
   - 모델 파일은 Git LFS로 관리됨
   - `git lfs pull` 실행 필요

4. **vocoder.onnx는 버전 간 동일**
   - 문제의 핵심은 text_encoder와 vector_estimator
   - vocoder만 같다고 호환되지 않음

## 관련 링크

- [Supertonic v2 Models (HuggingFace)](https://huggingface.co/Supertone/supertonic-2)
- [Supertonic GitHub](https://github.com/supertone-inc/supertonic)
- [Issue #004: ONNX 로딩 문제](./004-supertonic-onnx-vite-issue.md)

## 환경 정보

- Supertonic 모델: v1.6.0 (다국어)
- onnxruntime-web: 1.17.0
- Vite: 6.0.7
- Tauri: 2.0

## 관련 파일

- `src/services/voice/supertonicClient.ts` - Supertonic TTS 클라이언트
- `public/models/supertonic/onnx/` - ONNX 모델 파일
- `public/models/supertonic/voice_styles/` - 음성 스타일 파일
