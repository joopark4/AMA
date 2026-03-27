# MyPartnerAI

An AI avatar desktop app that moves freely on your screen and interacts with you through text and voice.

Korean version: [README.md](README.md)

![Platform](https://img.shields.io/badge/platform-macOS-blue)
![License](https://img.shields.io/badge/license-BSD--2--Clause-green)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![React](https://img.shields.io/badge/React-18-blue)

## Core Behavior

- Fixed bottom-right controls:
  - Text input
  - Voice recognition
  - Settings
- Avatar:
  - Click/select, drag to move, drag to rotate
  - Speech bubble is automatically positioned above the avatar
- Voice:
  - STT: Whisper local (`base/small/medium`)
  - TTS: Supertonic (`F1~F5`, `M1~M5`)
  - Global shortcut: default `Cmd+Shift+Space` (works regardless of focused app)
- When a remote session is detected:
  - Voice input (STT) is blocked
  - Text chat remains available

## Tested Hardware

| Device | CPU/SoC | Memory |
|--------|---------|--------|
| MacBook Pro | Apple M1 Max | 32 GB |
| Mac mini | Apple M4 | 24 GB |

## Requirements

- Node.js 20+
- Rust 1.75+ ([rustup](https://rustup.rs/))

## Download Models (Required)

Model files are too large to include in the repository. Place them manually before running the app.

### TTS Model (Supertonic)

Git LFS is required:

```bash
brew install git-lfs
git lfs install
```

Download from HuggingFace:

```bash
git clone https://huggingface.co/Supertone/supertonic models/supertonic
```

> ~250 MB total. After cloning, `models/supertonic/onnx/` and `models/supertonic/voice_styles/` must exist.

### STT Model (Whisper)

Only one model is needed. Start with `base`:

```bash
mkdir -p models/whisper

# base (~141 MB, fast, recommended starting point)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin \
  -o models/whisper/ggml-base.bin

# small (~465 MB, improved accuracy)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin \
  -o models/whisper/ggml-small.bin

# medium (~1.4 GB, highest accuracy)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin \
  -o models/whisper/ggml-medium.bin
```

### Expected Directory Structure

```
models/
├── supertonic/
│   ├── onnx/              ← duration_predictor.onnx, text_encoder.onnx, etc.
│   └── voice_styles/      ← F1.json ~ F5.json, M1.json ~ M5.json
└── whisper/
    └── ggml-base.bin      ← (or small / medium)
```

---

## Development Run

```bash
# 1) Clone
git clone https://github.com/joopark4/MyPartnerAI.git
cd MyPartnerAI

# 2) Install dependencies
npm install

# 3) Run in development mode (asset prep + Vite + Tauri)
npm run tauri dev
```

## Build

```bash
# Standard production build
npm run tauri build
```

## First-Run Guide

1. Launch the app
2. If no VRM is selected, choose a `.vrm` file in the center prompt
3. Open Settings (bottom-right) and configure:
   - LLM provider/model
   - Whisper model (`base/small/medium`)
   - Supertonic voice
   - Global voice shortcut on/off and key binding
4. Start chatting via microphone or text input

## Global Voice Shortcut

- Default: `Cmd+Shift+Space`
- Behavior: press once to start voice input, press again to stop
- Location: `Settings > Voice > Global Voice Shortcut`
- Input method: focus the shortcut field and press your key combo directly
- If registration fails:
  - Use the in-app warning toast action to open Accessibility settings
  - Switch to a different combo if another app/system shortcut conflicts

## Models / Runtime

- Whisper models: `base`, `small`, `medium`
- Supertonic models: `onnx`, `voice_styles`
- VRM is not bundled by default; user selects a local file on first run.

## Optional Environment Variables

Copy `.env.example` to `.env` and set values as needed:

```env
# Cloud LLM API keys (if used)
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
VITE_GOOGLE_API_KEY=

# Local LLM endpoint (default)
VITE_OLLAMA_ENDPOINT=http://localhost:11434
```

## AI Setup (Ollama / Gemini / etc.)

Configure `LLM Provider`, `Model`, `Endpoint`, and `API Key` in the in-app settings.

### 1) Ollama (local, recommended default)

```bash
# install on macOS
brew install ollama

# start server
ollama serve

# pull a model (example)
ollama pull deepseek-v3
```

In app settings:

- `LLM Provider`: `ollama`
- `Endpoint`: `http://localhost:11434`
- `Model`: `deepseek-v3` (or your pulled model)

### 2) Gemini (cloud)

1. Issue an API key from Google AI Studio
2. Set either:

```env
VITE_GOOGLE_API_KEY=your_key
```

or enter it directly in the app settings API Key field.

In app settings:

- `LLM Provider`: `gemini`
- `Model`: e.g. `gemini-2.0-flash`

### 3) OpenAI / Claude (cloud)

- OpenAI: `VITE_OPENAI_API_KEY` or app settings API key field
- Claude: `VITE_ANTHROPIC_API_KEY` or app settings API key field
- Select provider/model in app settings

### 4) LocalAI (local server)

- Run LocalAI with an OpenAI-compatible endpoint
- In app settings:
  - `LLM Provider`: `localai`
  - `Endpoint`: e.g. `http://localhost:8080`
  - `Model`: loaded LocalAI model id

If replies fail, verify provider/model/endpoint/API key first.

## Claude Code Channels (Avatar ↔ Claude Code)

Connect the AMA avatar to an external Claude Code session running in a separate terminal.
User text/voice input is sent to Claude Code, and responses are spoken aloud by the avatar via TTS.

### Demo

<video src="docs/movie/ccc-01.mp4" controls width="720">
  Claude Code Channels integration demo
</video>

> Claude Code Channels demo — the user asks a question via voice, Claude Code analyzes/executes code, and the avatar delivers the response with TTS and facial expressions.

### Usage

1. Install channel dependencies (one-time): `cd mcp-channels && npm install && cd ..`
2. Run AMA: `npm run tauri dev`
3. `Settings > Claude Code Channels > Toggle ON` (auto-registers with Claude Code + switches AI model)
4. In a separate terminal, start Claude Code:
   ```bash
   claude --dangerously-load-development-channels server:ama-bridge --permission-mode bypassPermissions
   ```
5. Select `Yes` at the initial confirmation prompt (once per session)
6. Chat via AMA → Claude Code responds → avatar speaks via TTS

Toggling OFF automatically restores your previous AI model settings.

### Important Notes

- Channels is a **research preview** feature. The `--dangerously-load-development-channels` flag is required, and a security confirmation prompt appears once per session.
- `--permission-mode bypassPermissions` auto-accepts tool execution permissions. **Use only in trusted local environments.**
- AMA and Claude Code must run on the **same machine** (localhost).

See [Claude Code Channels Guide](docs/channels-mcp.md) for details.

---

## AI/Model Licenses and Links

### 1) AI Services / Runtime

| Item | Usage | License/Terms | Link |
|------|------|---------------|------|
| Ollama | Local LLM server | MIT License | [github.com/ollama/ollama](https://github.com/ollama/ollama) |
| LocalAI | Local OpenAI-compatible server | MIT License | [github.com/mudler/LocalAI](https://github.com/mudler/LocalAI) |
| Claude API | Cloud LLM | Anthropic Terms | [anthropic.com/claude](https://www.anthropic.com/claude) |
| OpenAI API | Cloud LLM | OpenAI Terms | [platform.openai.com](https://platform.openai.com/) |
| Gemini API | Cloud LLM | Google Terms | [ai.google.dev](https://ai.google.dev/) |
| ONNX Runtime Web | Supertonic inference runtime | MIT License | [github.com/microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) |

### 2) Voice Models / Engines

| Item | Usage | License | Link |
|------|------|----------|------|
| whisper.cpp | STT engine (`whisper-cli`) | MIT License | [github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) |
| Whisper (OpenAI) | Base STT model family | MIT License (OpenAI Whisper repo) | [github.com/openai/whisper](https://github.com/openai/whisper) |
| GGML Whisper models (`ggml-base/small/medium`) | Local STT models | Follow upstream/distributor license | [huggingface.co/ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) |
| Supertonic code | TTS engine implementation | MIT License | [github.com/supertone-inc/supertonic](https://github.com/supertone-inc/supertonic) |
| Supertonic models | Local TTS models | BigScience Open RAIL-M (`models/supertonic/LICENSE`) | [huggingface.co/Supertone/supertonic](https://huggingface.co/Supertone/supertonic) |

Notes:

- Cloud AI services (Claude/OpenAI/Gemini) are governed by service terms, not open-source licenses.
- Always verify the latest LICENSE/terms before redistributing models/runtime assets.

## Uninstalling

To completely remove AMA from macOS:

1. Delete `AMA.app` from the `Applications` folder
2. Remove downloaded model data:
   ```bash
   rm -rf ~/.mypartnerai
   ```

> You can also delete model data from `Settings > Data Management` within the app.

## Troubleshooting

### 1) Voice input button does not work

- Check whether you are in a remote session
- Check microphone permission
- Check Whisper model/runtime file paths
- If using the global shortcut, also check Accessibility permission and shortcut conflicts

### 2) TTS has no sound

- Run TTS test in settings and check errors
- Verify Supertonic model paths (`onnx`, `voice_styles`)

### 3) VRM load failure

- Confirm `.vrm` file validity
- Re-select VRM in avatar settings

## How to Get or Buy VRM Files

### Recommended Sources

| Site | Type | Notes |
|------|------|------|
| [VRoid Hub](https://hub.vroid.com/en/) | Mostly free shared models | Download is available only when the creator allows it |
| [BOOTH (VRM search)](https://booth.pm/en/search/VRM) | Free + paid | Largest marketplace for creator-made VRM assets |
| [VRoid Studio](https://vroid.com/en/studio/) | Create your own (free) | Build your own avatar and export as `.vrm` |

### 1) Get Free VRM Files (VRoid Hub)

1. Sign in to VRoid Hub
2. Open a model page and check whether download/use is allowed
3. Review usage terms (personal/commercial/edit/redistribution/credit)
4. Download the `.vrm` file and select it in the app

Notes:
- Not every model is downloadable.
- Usage permissions vary by creator/model.

### 2) Buy VRM Files (BOOTH)

1. Browse [BOOTH VRM search](https://booth.pm/en/search/VRM)
2. Check price, previews, and update history
3. Read license/usage terms carefully  
   (commercial use, credit requirement, redistribution prohibition, etc.)
4. Purchase and download (`.zip` / `.vrm`)
5. Extract if needed, then select the `.vrm` file in the app

### 3) Create Your Own (VRoid Studio)

1. Install [VRoid Studio](https://vroid.com/en/studio/)
2. Create or edit your character
3. Export via `Export VRM`
4. Select the exported `.vrm` in the app

### VRM License Checklist

- Commercial use allowed?
- Streaming/video publishing allowed?
- Modification/editing allowed?
- Redistribution prohibited?
- Credit attribution required?

Note: This VRM get/buy guide is for reference only. Always verify the latest license and usage terms for each model before use.

## License

BSD 2-Clause
