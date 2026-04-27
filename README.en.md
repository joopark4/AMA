# AMA - AI My Avatar

An AI avatar desktop app that moves freely on your screen and interacts with you through text and voice.

Korean version: [README.md](README.md) | 日本語版: [README.ja.md](README.ja.md)

> For bug reports, feature requests, or any feedback, please email [jooparkhappy4@gmail.com](mailto:jooparkhappy4@gmail.com).

<a href="https://github.com/sponsors/joopark4">
  <img src="https://img.shields.io/badge/Sponsor%20on%20GitHub-ea4aaa?style=for-the-badge&logo=github-sponsors&logoColor=white" alt="Sponsor on GitHub" height="60">
</a>
<a href="https://www.buymeacoffee.com/eunyeon">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-red.png" alt="Buy Me A Coffee" width="217" height="60">
</a>
<a href="https://toon.at/donate/heavyarm">
  <img src="https://img.shields.io/badge/Donate%20on%20Toonation-00B9F1?style=for-the-badge&logoColor=white" alt="Donate on Toonation" height="60">
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

## Usage Notes (v2.0.0)

### 🔄 Auto Update
- **In-app auto update check is supported from v2.0.0 onwards.**
- Settings → App Update → "Check for Updates" (manual). Background re-check every 24 hours.
- When an update is found, the top-right notification card guides you through Install → Download → Restart.
- Users on v1.x or earlier must manually download the v2.0.0 dmg and reinstall (old signing key is incompatible).

### ✨ Premium Voice (Beta)
Premium (cloud) TTS is offered as **a limited beta feature**.

- Available **only to signed-in users** (Google OAuth)
- **Shared-pool model**: all beta users consume from a single pool — there is no per-user allocation.
- Replenishment timing is not fixed; once the pool is depleted, premium voice is temporarily unavailable.
- When depleted, the app **automatically falls back to local voice (Supertonic)** — no user action needed.
- **Beta may be disabled without prior notice** when the beta period ends.
- The shape of the eventual GA offering (subscription or other) will be announced separately.

> If the shared balance shows "Couldn't load the shared balance" or doesn't appear, the pool may be fully depleted. Try again later or continue with the local voice.

### 💃 Avatar Motions (current limitation)
- The current default motion catalog leans **toward more feminine motion styles**.
- A wider variety of gender/style motions will be added.
- Source-build users can download FBX from [Mixamo](https://www.mixamo.com/) into `motions/mixamo/` and run `npm run motion:refresh` to regenerate the catalog.

### 🤝 AI CLI Connection Status (Codex / Gemini CLI / Claude Code Channels)
These external CLIs **spawn their backend process on the first conversation**. Right after installation, the connection status in the settings panel may show **"Disconnected" — this is expected.**

How to resolve:
1. First confirm the CLI is properly installed and signed in (see each guide's "Verify install").
   ```bash
   codex --version       && codex login status        # OpenAI Codex CLI
   gemini --version      && gemini auth print          # Gemini CLI (ACP)
   claude --version                                    # Claude Code
   ```
2. Select the provider in Settings → AI Model.
3. **Have 1–3 short conversations with the avatar.**
4. The backend spawns on the first message; the status flips to "Connected" automatically thereafter.

> If it still says "Disconnected" after a few conversations, check CLI login state and working-folder permissions first. If the issue persists, please [file a bug report](mailto:jooparkhappy4@gmail.com).

---

## Demo

> A live demo of two-way conversation between the AMA avatar and Claude Code via Claude Code Channels. The user asks a question in AMA, Claude Code responds, and the avatar delivers the answer via TTS.

<img src="public/demo/ccc-01.gif" alt="Claude Code Channels Demo" style="max-width:100%;height:auto;" width="360">

> A live demo of two-way conversation between the AMA avatar and Codex via OpenAI Codex CLI. The user asks a question in AMA, Codex performs coding tasks and responds, and the avatar delivers the answer via TTS.

<img src="public/demo/codex-demo.gif" alt="OpenAI Codex CLI Demo" style="max-width:100%;height:auto;" width="360">

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

> ⚠️ **Notice — assets not in this repository**
>
> This repository **does not include** assets that cannot be redistributed under their license, or that are governed by the author/platform's terms of use. Notably:
>
> - **Mixamo FBX motion files** (`motions/mixamo/*.fbx`) — Adobe Mixamo terms allow personal use only; redistribution prohibited
> - **Default VRM avatar** (`src-tauri/assets/default.vrm`) — author copyright
>
> To build from source, you'll need to **prepare and place these assets yourself**, then rebuild. Without them, the embedded default VRM will be empty (no default avatar shown), and the motion catalog may be empty (some animations won't run). See the [VRM acquisition guide](#how-to-get-or-buy-vrm-files) and per-category notes for details.

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

#### Motion Files (Mixamo)

Mixamo animation FBX files are not included in the repository due to license restrictions. Download them directly from [Mixamo](https://www.mixamo.com/) and place them in `public/motions/mixamo/`.

> Mixamo assets may only be used as integrated into a project. Standalone redistribution of original FBX files is not permitted.

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

## Settings Overview

The Settings panel slides in from the right. The **header** of the panel always shows an Account card (OAuth sign-in / Terms of service / Account deletion). Below it, the body is organized into the 14 sections below — each is a collapsible card whose expanded state is restored on next launch.

| # | Section | What it does |
|---|---|---|
| 1 | **Language** | UI language (한국어 / English / 日本語) |
| 2 | **Premium Voice** | Supertone API cloud TTS (Beta — shared pool for signed-in users). Voice / model / style / usage card |
| 3 | **AI Model** | LLM provider — Ollama · LocalAI (local) / Claude · OpenAI · Gemini (cloud) / OpenAI Codex CLI · Gemini CLI (local CLI agents). **When Codex or Gemini CLI is selected, that CLI's specific options (connection status / model / reasoning effort / working folder / approval policy) expand inside this same section.** |
| 4 | **Claude Code Channels** | MCP server auto registration + bidirectional dialogue between an external Claude Code session and the avatar |
| 5 | **Audio & Microphone** | Independent microphone input / speaker output device selection + mic peak meter |
| 6 | **Avatar** | VRM swap / expressions / initial gaze / free move / speech bubble / animation / physics / lighting |
| 7 | **Character** | Character preset (archetype) / personality keywords / emotional tendency / honorifics / example dialogues / proactive-speech toggle |
| 8 | **Voice (Local)** | STT engine (Whisper) · model (base/small/medium) + local TTS (Supertonic) voice & output language + global voice shortcut |
| 9 | **Screen Watch** | Periodic screen capture + Vision LLM analysis for proactive avatar speech — target / interval / response style / quiet hours / permissions |
| 10 | **Monitor** | Pick the monitor to display the avatar on (multi-monitor) |
| 11 | **Quick Actions** | Register frequently-used setting toggles → invoke instantly via the bottom-right ✨ icon or by voice |
| 12 | **App Update** | Current version / check / download progress / restart (re-checks every 24h) |
| 13 | **Data Management** | Manage downloaded AI model data (not removed automatically when uninstalling the app) |
| 14 | **Open-source / Model Licenses** | Licenses and official links for libraries · AI services · models |

> Open Settings via the gear icon in the bottom-right or the macOS menu bar `AMA → Settings...` (`⌘,`).

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

### How to Use OpenAI Codex CLI

Connect your AMA avatar to the OpenAI Codex CLI for two-way conversations with a coding agent.

#### Prerequisites

- [OpenAI Codex CLI](https://github.com/openai/codex) installed (`npm install -g @openai/codex`)
- Codex login completed (`codex login`)

#### Setup Steps

1. Launch AMA app
2. `Settings > LLM Provider > Codex`
3. CLI installation and login status are verified automatically
4. Once connected, additional options become available:
   - **Working Directory**: the directory Codex reads/writes code in (defaults to `~/Documents`)
   - **Model**: select from available models after connection
   - **Reasoning Effort**: Low / Medium / High / Extra High
   - **Approval Policy**: Approve on request (default) / Auto-approve / Approve untrusted only
5. Chat via AMA → Codex performs coding tasks and responds → avatar speaks via TTS

#### Important Notes

- Codex CLI automatically launches `codex app-server` in the background. No separate terminal setup is needed.
- Setting the approval policy to "Auto-approve" allows Codex to modify and execute files automatically. **Use only in trusted environments.**
- Switching to a different LLM provider automatically disconnects Codex.

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
| OpenAI Codex CLI | Coding agent | Apache 2.0 License | [github.com/openai/codex](https://github.com/openai/codex) |
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
