# #010 Supertonic TTS 모델 다국어 업데이트

## 상태: 해결됨 (2026-02-25)

## 증상

- TTS 음성 출력이 거의 무음 (maxAbs: 0.0046, 정상은 0.2~0.4)
- 한국어 텍스트 합성 시 소리가 들리지 않음
- 보코더 출력 파형의 진폭이 정상 대비 약 1/80 수준

## 원인

Supertonic TTS 모델이 **영어 전용 v1 모델**(`Supertone/supertonic`)로 설정되어 있었으나, 앱에서 **한국어 텍스트**를 합성하고 있었음.

### 상세 분석

| 항목 | 기존 (v1.5.0) | 최신 (v1.6.0) |
|------|--------------|--------------|
| HuggingFace 저장소 | `Supertone/supertonic` | `Supertone/supertonic-2` |
| 모델 split | `opensource-en` | `opensource-multilingual` |
| 지원 언어 | 영어만 | 영어, 한국어, 스페인어, 포르투갈어, 프랑스어 |

**문제 발생 흐름:**

1. 한국어 텍스트 입력 (예: "안녕 나는 은연이라고 해")
2. `unicode_indexer.json`(v1)에서 한글 문자가 모두 `-1`(미지원)로 매핑
3. `text_encoder`가 의미 없는 임베딩 생성
4. `vector_estimator` 디노이징 결과가 비정상
5. `vocoder` 입력은 형식상 유효하나, 내용이 무의미 → 거의 무음 출력

### 모델 파일 비교

| 파일 | v1 vs v2 |
|------|----------|
| `vocoder.onnx` | **동일** (해시 일치) |
| `duration_predictor.onnx` | **다름** (다국어 학습) |
| `text_encoder.onnx` | **다름** (다국어 학습) |
| `vector_estimator.onnx` | **다름** (다국어 학습) |
| `unicode_indexer.json` | **다름** (한글/다국어 문자 추가) |
| `voice_styles/*.json` | **모두 다름** (새 모델 기준 스타일) |

### Python 레퍼런스 검증

```
# v1 모델 + 영어 텍스트 → 정상
maxAbs: 0.369609 ✅

# v2 모델 + 한국어 텍스트 → 정상
maxAbs: 0.231997 ✅

# v1 모델 + 한국어 텍스트 → 오류
ValueError: unsupported character(s): ['고', '나', '녕', ...] ❌
```

Python SDK는 미지원 문자를 사전 검증하여 오류를 발생시키지만, 우리 JS 구현은 검증 없이 진행하여 무음이 출력되었음.

## 수정 내용

### 1. 모델 업데이트

`models/supertonic/` 전체를 `Supertone/supertonic-2` (v1.6.0) 모델로 교체:
- `onnx/tts.json` — 설정 파일 (split: opensource-multilingual)
- `onnx/unicode_indexer.json` — 다국어 문자 인덱서
- `onnx/duration_predictor.onnx` — 다국어 Duration Predictor
- `onnx/text_encoder.onnx` — 다국어 Text Encoder
- `onnx/vector_estimator.onnx` — 다국어 Vector Estimator
- `onnx/vocoder.onnx` — 동일 (변경 없음)
- `voice_styles/*.json` — 전체 10종 업데이트

동일 파일을 `public/models/supertonic/` 및 `src-tauri/resources/models/supertonic/`에도 반영.

### 2. 다운로드 URL 변경

`scripts/prepare-assets.mjs`:
```diff
- 'https://huggingface.co/Supertone/supertonic/resolve/main'
+ 'https://huggingface.co/Supertone/supertonic-2/resolve/main'
```

## 수정 후 결과

- 한국어 TTS: 정상 음성 출력 확인
- 영어 TTS: 정상 동작 유지

## 관련

- [#006 Supertonic 모델 버전 불일치](006-supertonic-model-version-mismatch.md)
- [#008 오디오 재생 무음](../../docs/issues/008-audio-playback-silence.md) (WKWebView 이슈와는 별개)
