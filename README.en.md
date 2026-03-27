# AMA - AI My Avatar

An AI avatar desktop app that moves freely on your screen and interacts with you through text and voice.

Korean version: [README.md](README.md)

> For bug reports, feature requests, or any feedback, please email [jooparkhappy4@gmail.com](mailto:jooparkhappy4@gmail.com).

<a href="https://www.buymeacoffee.com/eunyeon">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-red.png" alt="Buy Me A Coffee" width="217" height="60">
</a>

![Platform](https://img.shields.io/badge/platform-macOS-blue)
![License](https://img.shields.io/badge/license-MIT-green)
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

## Demo

> A live demo of two-way conversation between the AMA avatar and Claude Code via Claude Code Channels. The user asks a question in AMA, Claude Code responds, and the avatar delivers the answer via TTS.

[▶ Watch Demo (Claude Code Channels)](etc/demo/ccc-01.mp4)

## Tested Hardware

| Device | CPU/SoC | Memory |
|--------|---------|--------|
| MacBook Pro | Apple M1 Max | 32 GB |
| Mac mini | Apple M4 | 24 GB |

---

## Option 1: DMG Install (Regular Users)

### Installation

1. Download `AMA_x.x.x_aarch64.dmg` from [Latest Release](https://github.com/joopark4/AMA/releases/latest) — [v0.8.0 direct link](https://github.com/joopark4/AMA/releases/tag/v0.8.0)
2. Open the DMG and drag `AMA.app` to the `Applications` folder
3. Launch AMA from Launchpad or Applications

### First Run

1. On first launch, the app prompts to download required models (TTS/STT)
2. After model download, enter your avatar name
3. Select a `.vrm` avatar file (can be changed later in Settings > Avatar)
4. Configure AI model in the bottom-right Settings button, then start chatting

### AI Setup

Configure `LLM Provider`, `Model`, `Endpoint`, and `API Key` in the in-app settings.

#### Ollama (local, recommended default)

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

#### Gemini (cloud)

1. Issue an API key from Google AI Studio
2. Enter it directly in the app settings API Key field

In app settings:

- `LLM Provider`: `gemini`
- `Model`: e.g. `gemini-2.0-flash`

#### OpenAI / Claude (cloud)

- Select Provider in app settings, then enter your API key
- Select provider/model in app settings

#### LocalAI (local server)

- Run LocalAI with an OpenAI-compatible endpoint
- In app settings:
  - `LLM Provider`: `localai`
  - `Endpoint`: e.g. `http://localhost:8080`
  - `Model`: loaded LocalAI model id

> If replies fail, verify provider/model/endpoint/API key first.

### Auto Update

Check for updates in the settings panel or from the macOS menu bar "Check for Updates...".
When a new version is available, it downloads automatically and restarts.

---

## Option 2: Build from Source (Developers)

### Requirements

- Node.js 20+
- Rust 1.75+ ([rustup](https://rustup.rs/))

### Download Models (Required)

Model files are too large to include in the repository. Place them manually before running the app.

#### TTS Model (Supertonic)

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

#### STT Model (Whisper)

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

#### Expected Directory Structure

```
models/
├── supertonic/
│   ├── onnx/              ← duration_predictor.onnx, text_encoder.onnx, etc.
│   └── voice_styles/      ← F1.json ~ F5.json, M1.json ~ M5.json
└── whisper/
    └── ggml-base.bin      ← (or small / medium)
```

### AI Setup

Configure `LLM Provider`, `Model`, `Endpoint`, and `API Key` in the in-app settings.
Setup is the same as [Option 1 AI Setup](#ai-setup).

For development, you can also use a `.env` file:

```bash
cp .env.example .env
```

```env
# Cloud LLM API keys (if used)
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
VITE_GOOGLE_API_KEY=

# Local LLM endpoint (default)
VITE_OLLAMA_ENDPOINT=http://localhost:11434
```

### Development Run

```bash
# 1) Clone
git clone https://github.com/joopark4/AMA.git
cd AMA

# 2) Install dependencies
npm install

# 3) Run in development mode (asset prep + Vite + Tauri)
npm run tauri dev
```

### Build

```bash
# Standard production build
npm run tauri build
```

---

## Common Guide

### Global Voice Shortcut

- Default: `Cmd+Shift+Space`
- Behavior: press once to start voice input, press again to stop
- Location: `Settings > Voice > Global Voice Shortcut`
- Input method: focus the shortcut field and press your key combo directly
- If registration fails:
  - Use the in-app warning toast action to open Accessibility settings
  - Switch to a different combo if another app/system shortcut conflicts

### How to Use Claude Code Channels

Connect your AMA avatar to Claude Code for two-way conversations.

#### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- [Node.js](https://nodejs.org/) 18+ installed
- Logged in to claude.ai (`claude login`)

#### Setup Steps

1. Launch AMA app
2. `Settings > Claude Code Channels > Toggle ON`
   - Bridge plugin auto-installs to `~/.mypartnerai/ama-bridge/`
   - MCP server auto-registers in Claude Code (`~/.claude.json`)
   - If auto-install fails: `cd ~/.mypartnerai/ama-bridge && npm install`
3. In a separate terminal, run Claude Code:
   ```bash
   claude --dangerously-load-development-channels server:ama-bridge --permission-mode bypassPermissions
   ```
4. Select `Yes` at the initial confirmation prompt (once per session)
5. Chat via AMA → Claude Code responds → avatar speaks via TTS

Toggling OFF automatically restores your previous AI model settings.

#### Important Notes

- Channels is a **research preview** feature. The `--dangerously-load-development-channels` flag is required, and a security confirmation prompt appears once per session.
- `--permission-mode bypassPermissions` auto-accepts tool execution permissions. **Use only in trusted local environments.**
- AMA and Claude Code must run on the **same machine** (localhost).

---

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

---

## How to Get or Buy VRM Files

### Recommended Sources

| Site | Type | Notes |
|------|------|------|
| [VRoid Hub](https://hub.vroid.com/en/) | Mostly free shared models | Download is available only when the creator allows it |
| [BOOTH (VRM search)](https://booth.pm/en/search/VRM) | Free + paid | Largest marketplace for creator-made VRM assets |
| [VRoid Studio](https://vroid.com/en/studio/) | Create your own (free) | Build your own avatar and export as `.vrm` |

### VRM License Checklist

- Commercial use allowed?
- Streaming/video publishing allowed?
- Modification/editing allowed?
- Redistribution prohibited?
- Credit attribution required?

> This VRM guide is for reference only. Always verify the latest license and usage terms for each model before use.

---

## Uninstalling

To completely remove AMA from macOS:

1. Delete `AMA.app` from the `Applications` folder
2. Remove downloaded model data:
   ```bash
   rm -rf ~/.mypartnerai
   ```

> You can also delete model data from `Settings > Data Management` within the app.

---

## AI/Model Licenses and Links

### AI Services / Runtime

| Item | Usage | License/Terms | Link |
|------|------|---------------|------|
| Ollama | Local LLM server | MIT License | [github.com/ollama/ollama](https://github.com/ollama/ollama) |
| LocalAI | Local OpenAI-compatible server | MIT License | [github.com/mudler/LocalAI](https://github.com/mudler/LocalAI) |
| Claude API | Cloud LLM | Anthropic Terms | [anthropic.com/claude](https://www.anthropic.com/claude) |
| OpenAI API | Cloud LLM | OpenAI Terms | [platform.openai.com](https://platform.openai.com/) |
| Gemini API | Cloud LLM | Google Terms | [ai.google.dev](https://ai.google.dev/) |
| ONNX Runtime Web | Supertonic inference runtime | MIT License | [github.com/microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) |

### Voice Models / Engines

| Item | Usage | License | Link |
|------|------|----------|------|
| whisper.cpp | STT engine | MIT License | [github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) |
| Whisper (OpenAI) | Base STT model | MIT License | [github.com/openai/whisper](https://github.com/openai/whisper) |
| Supertonic code | TTS engine | MIT License | [github.com/supertone-inc/supertonic](https://github.com/supertone-inc/supertonic) |
| Supertonic models | Local TTS models | BigScience Open RAIL-M | [huggingface.co/Supertone/supertonic](https://huggingface.co/Supertone/supertonic) |

> Cloud AI services (Claude/OpenAI/Gemini) are governed by service terms, not open-source licenses. Always verify the latest LICENSE before redistributing models/runtime assets.

## Default Avatar Copyright

The default VRM avatar bundled in the DMG release is the property of the project author and is **NOT covered by the MIT License.**

- Use is permitted only within this app.
- Extraction, redistribution, or use in other apps/services is prohibited.
- The source code repository does not include the default avatar.

## License

MIT — Applies to the source code, excluding the default avatar.
