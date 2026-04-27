# AMA - AI My Avatar

画面上を自由に移動する AI アバターデスクトップアプリです。
テキスト・音声入力、音声応答（TTS）、VRM アバターとのインタラクションを提供します。

한국어판: [README.md](README.md) | English version: [README.en.md](README.en.md)

> バグ報告、機能提案などのフィードバックは [jooparkhappy4@gmail.com](mailto:jooparkhappy4@gmail.com) までお送りください。

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

## 基本動作

- 右下固定ボタン:
  - テキスト入力
  - 音声認識
  - 設定（オプション）
- アバター:
  - マウスで選択/移動/回転可能
  - 吹き出しはアバターの上部に自動配置
- 音声:
  - STT: Whisper（ローカル、`base/small/medium`）
  - TTS: Supertonic（`F1~F5`、`M1~M5`）
  - グローバルショートカット: デフォルト `Cmd+Shift+Space`（アプリのフォーカスに関係なく動作）
- リモートセッション検出時:
  - 音声認識（STT）はブロック
  - テキストチャットは引き続き利用可能

## ご利用上の注意 (v2.0.0)

### 🔄 自動更新
- **v2.0.0 以降からアプリ内の自動更新確認をサポート**します。
- 設定 → アプリ更新 → "更新確認" で手動チェック可能、24時間ごとにバックグラウンドで自動再確認。
- 更新がある場合、右上の通知カードから インストール → ダウンロード → 再起動 の流れで進みます。
- v1.x 以前を使用していたユーザーは v2.0.0 dmg を直接ダウンロードして新規インストールしてください（旧署名鍵と互換性がありません）。

### ✨ プレミアム音声（ベータ）
プレミアム音声（クラウド TTS）は **ベータ機能として限定提供**されます。

- **ログイン済みユーザーのみ利用可能**（Google OAuth）
- **共有資源方式**: すべてのベータユーザーが共同で消費する残高から差し引かれます — 個人割当ではありません。
- 資源の補充タイミングは一定ではなく、残高が尽きると一時的に利用できません。
- 残高消尽時は **自動的にローカル音声（Supertonic）に切り替わります** — ユーザー操作は不要です。
- **ベータ期間終了時、本機能は事前告知なく無効化される場合があります。**
- 正式リリース時の提供方式（サブスクなど）は別途告知予定です。

> 残高が表示されない、または「共有残高情報を取得できません」と表示される場合、残高がすべて使い切られている可能性があります。しばらく時間をおくか、ローカル音声をそのままご利用ください。

### 💃 アバターモーション（現状の制限）
- 現在のデフォルトモーションカタログは **やや女性らしい動作中心**で構成されています。
- 今後、多様な性別・スタイルのモーションを追加予定です。
- ソースビルドのユーザーは [Mixamo](https://www.mixamo.com/) から直接 FBX をダウンロードして `motions/mixamo/` に追加し、`npm run motion:refresh` でカタログを再生成して利用できます。

### 🤝 AI CLI 接続状態のご案内（Codex / Gemini CLI / Claude Code Channels）
これら外部 CLI は **最初の会話の時点でバックエンドプロセスが自動 spawn** されます。インストール直後は設定パネルの接続状態が **「未接続」と表示されることがありますが — 正常動作です。**

解決手順:
1. まず CLI が正常にインストール・ログインされているか確認します（各ガイドの「インストール状態確認」項目を参照）。
   ```bash
   codex --version       && codex login status        # OpenAI Codex CLI
   gemini --version      && gemini auth print          # Gemini CLI (ACP)
   claude --version                                    # Claude Code
   ```
2. 設定 → AI モデル で該当 Provider を選択します。
3. アバターに **任意の会話を 1〜3回行ってください**。
4. 最初の会話時にプロセスが spawn され、その直後から接続状態が「接続済み」に自動更新されます。

> インストール済みなのに数回の会話後も「未接続」のままなら、CLI のログイン状態や作業フォルダのアクセス権限をまずご確認ください。それでも解決しない場合は[バグレポート](mailto:jooparkhappy4@gmail.com)をお願いします。

---

## デモ

> Claude Code Channels を通じた AMA アバターと Claude Code 間のリアルタイム双方向対話デモです。ユーザーが AMA で質問すると Claude Code が応答し、アバターが TTS で音声回答を提供します。

<img src="public/demo/ccc-01.gif" alt="Claude Code Channels デモ" style="max-width:100%;height:auto;" width="360">

> OpenAI Codex CLI を通じた AMA アバターと Codex 間のリアルタイム双方向対話デモです。ユーザーが AMA で質問すると Codex がコーディング作業を実行して応答し、アバターが TTS で音声回答を提供します。

<img src="public/demo/codex-demo.gif" alt="OpenAI Codex CLI デモ" style="max-width:100%;height:auto;" width="360">

## テスト環境

| 機器 | CPU/SoC | メモリ |
|------|---------|--------|
| MacBook Pro | Apple M1 Max | 32 GB |
| Mac mini | Apple M4 | 24 GB |

---

## 方法 1: DMG インストール（一般ユーザー）

### インストール

1. [最新リリース](https://github.com/joopark4/AMA/releases/latest)から `AMA_x.x.x_aarch64.dmg` をダウンロード — [v0.8.0 直リンク](https://github.com/joopark4/AMA/releases/tag/v0.8.0)
2. DMG を開き、`AMA.app` を `Applications` フォルダにドラッグ
3. Launchpad または Applications から AMA を起動

### 初回起動

1. 初回起動時に必須モデル（TTS/STT）の自動ダウンロード案内
2. モデルダウンロード完了後、アバター名を入力
3. `.vrm` アバターファイルを選択（設定 > アバターで変更可能）
4. 右下の設定ボタンで AI モデルを設定後、会話を開始

### AI 設定方法

アプリ起動後、右下の設定ボタンで `LLM Provider`、`Model`、`Endpoint`、`API Key` を設定します。

#### Ollama（ローカル、推奨デフォルト）

```bash
# macOS インストール
brew install ollama

# サーバー起動
ollama serve

# モデルダウンロード例
ollama pull deepseek-v3
```

設定画面で:

- `LLM Provider`: `ollama`
- `Endpoint`: `http://localhost:11434`
- `Model`: `deepseek-v3`（またはダウンロードしたモデル名）

#### Gemini（クラウド）

1. Google AI Studio で API Key を発行
2. アプリ設定の `API Key` 入力欄に直接入力

設定画面で:

- `LLM Provider`: `gemini`
- `Model`: 例）`gemini-2.0-flash`

#### OpenAI / Claude（クラウド）

- アプリ設定画面で Provider を選択後、API Key を入力
- Provider/Model は設定画面で選択

#### LocalAI（ローカルサーバー）

- LocalAI サーバー起動後、OpenAI 互換 endpoint を準備
- 設定画面で:
  - `LLM Provider`: `localai`
  - `Endpoint`: LocalAI アドレス（例: `http://localhost:8080`）
  - `Model`: LocalAI にロードされたモデル id

> 応答がない場合、Provider/Model/Endpoint/API Key の値が正しいか確認してください。

### 自動アップデート

設定パネルまたは macOS メニューバーの「Check for Updates...」からアップデートを確認できます。
新しいバージョンがあれば自動でダウンロード後、再起動されます。

---

## 方法 2: ソースビルド（開発者）

### 要件

- Node.js 20+
- Rust 1.75+（[rustup](https://rustup.rs/)）

### モデルダウンロード（必須）

AI モデルファイルはサイズが大きいためリポジトリに含まれていません。実行前に以下のパスに直接配置してください。

#### TTS モデル（Supertonic）

Git LFS がインストールされている必要があります:

```bash
brew install git-lfs
git lfs install
```

HuggingFace からダウンロード:

```bash
git clone https://huggingface.co/Supertone/supertonic models/supertonic
```

> 合計約 250MB。ダウンロード後、`models/supertonic/onnx/` と `models/supertonic/voice_styles/` が存在する必要があります。

#### STT モデル（Whisper）

モデルは 1 つだけあれば十分です。まず base をダウンロードすることを推奨します:

```bash
mkdir -p models/whisper

# base (~141 MB、高速、推奨開始点)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin \
  -o models/whisper/ggml-base.bin

# small (~465 MB、精度向上)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin \
  -o models/whisper/ggml-small.bin

# medium (~1.4 GB、最高精度)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin \
  -o models/whisper/ggml-medium.bin
```

#### 最終ディレクトリ構造

```
models/
├── supertonic/
│   ├── onnx/              ← duration_predictor.onnx, text_encoder.onnx など
│   └── voice_styles/      ← F1.json ~ F5.json, M1.json ~ M5.json
└── whisper/
    └── ggml-base.bin      ← （または small / medium）
```

#### モーションファイル（Mixamo）

Mixamo アニメーション FBX ファイルはライセンス制限によりリポジトリに含まれていません。[Mixamo](https://www.mixamo.com/) から直接ダウンロードし、`public/motions/mixamo/` に配置してください。

> Mixamo アセットはプロジェクトに統合された形でのみ使用可能であり、オリジナル FBX の独立した再配布は許可されていません。

### AI 設定方法

アプリ起動後、右下の設定ボタンで `LLM Provider`、`Model`、`Endpoint`、`API Key` を設定します。
設定方法は[方法 1 の AI 設定方法](#ai-設定方法)と同じです。

開発環境では `.env` ファイルでも設定可能です:

```bash
cp .env.example .env
```

```env
# Cloud LLM API Key（該当 provider 使用時）
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
VITE_GOOGLE_API_KEY=

# Local LLM endpoint（デフォルト）
VITE_OLLAMA_ENDPOINT=http://localhost:11434
```

### 開発実行

```bash
# 1) リポジトリクローン
git clone https://github.com/joopark4/AMA.git
cd AMA

# 2) 依存関係インストール
npm install

# 3) 開発モード実行（モデル準備 + Vite + Tauri）
npm run tauri dev
```

### ビルド

```bash
# 通常プロダクションビルド
npm run tauri build
```

---

## 設定メニュー紹介

設定パネル（右側スライドイン）は以下の項目で構成されます。各セクションはカード UI で開閉可能で、開閉状態は次回起動時に再現されます。

| セクション | 主な機能 |
|---|---|
| アカウント | OAuth ログイン（Google）/ 利用規約 / アカウント削除 |
| 言語 | アプリ UI 言語（한국어 / English / 日本語） |
| AI モデル | LLM プロバイダ選択 — Ollama · LocalAI（ローカル）/ Claude · OpenAI · Gemini（クラウド）/ Codex · Gemini CLI（ローカル CLI） |
| オーディオデバイス | マイク入力 / スピーカー出力デバイスの独立選択 + マイクピークメーター |
| 音声 | STT エンジン（Whisper）· モデル選択（base/small/medium）+ ローカル TTS（Supertonic）音声/言語 + グローバルショートカット |
| プレミアム音声 | Supertone API クラウド TTS（サブスク必要）+ 音声/モデル/スタイル/使用量ダッシュボード |
| アバター | VRM ファイル変更 / 表情 / 初期視線 / 自由移動 / 吹き出し / アニメーション / 物理 / 照明 |
| 画面観察 | Vision LLM 周期観察（能動発話）— キャプチャ対象 / 観察間隔 / 応答スタイル / 静かな時間 |
| Claude Code Channels | MCP サーバー自動登録 + Claude Code との双方向対話 |
| Codex | OpenAI Codex CLI 接続状態 / モデル / 推論性能 / 作業フォルダ / アクセス権限 |
| アプリ更新 | 現在バージョン / 更新確認 / ダウンロード / 再起動 |
| オープンソースライセンス | 使用ライブラリ・AI サービス・モデルのライセンス表記 |

> 設定パネルは右上の歯車アイコン、または macOS メニューバー `AMA → Settings...`（`⌘,`）から開けます。

---

## 共通ガイド

### グローバル音声ショートカット

- デフォルト: `Cmd+Shift+Space`
- 動作: ショートカット 1 回入力で音声入力開始、再度入力で終了
- 設定場所: `設定 > 音声 > グローバル音声ショートカット`
- 入力方法: ショートカット入力欄をクリックした状態でキーの組み合わせを直接押すと保存
- 登録失敗時:
  - アプリ内の警告トーストからアクセシビリティ設定を開くボタンを使用
  - 他のアプリ/システムショートカットと競合する場合は別の組み合わせに変更

### Claude Code Channels の使い方

AMA アバターを Claude Code と接続して双方向の会話が可能です。

#### 前提条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI インストール済み
- [Node.js](https://nodejs.org/) 18+ インストール済み
- claude.ai アカウントログイン済み（`claude login`）

#### 設定手順

1. AMA アプリを起動
2. `設定 > Claude Code Channels > トグル ON`
   - Bridge プラグイン自動インストール（`~/.mypartnerai/ama-bridge/`）
   - Claude Code に MCP サーバー自動登録（`~/.claude.json`）
   - 自動インストール失敗時: `cd ~/.mypartnerai/ama-bridge && npm install`
3. 別のターミナルで Claude Code を実行:
   ```bash
   claude --dangerously-load-development-channels server:ama-bridge --permission-mode bypassPermissions
   ```
4. 初回確認プロンプトで `Yes` を選択（セッションごとに 1 回）
5. AMA で会話 → Claude Code が応答 → アバターが TTS で読み上げ

トグル OFF 時、以前の AI モデル設定に自動復元されます。

#### 注意事項

- Channels は**リサーチプレビュー**機能です。`--dangerously-load-development-channels` フラグが必須であり、セッション開始時にセキュリティ確認プロンプトが 1 回表示されます。
- `--permission-mode bypassPermissions` はツール実行権限を自動承認します。**信頼できるローカル環境でのみ使用**してください。
- AMA と Claude Code は**同じマシン**（localhost）で実行する必要があります。

### OpenAI Codex CLI の使い方

AMA アバターを OpenAI Codex CLI と接続して、コーディングエージェントとの双方向会話が可能です。

#### 前提条件

- [OpenAI Codex CLI](https://github.com/openai/codex) インストール済み（`npm install -g @openai/codex`）
- Codex ログイン済み（`codex login`）

#### 設定手順

1. AMA アプリを起動
2. `設定 > LLM Provider > Codex` を選択
3. CLI のインストール状態とログイン状態が自動的に確認されます
4. 接続後、追加設定が可能:
   - **作業フォルダ**: Codex がコードを読み書きするディレクトリ（未指定時は `~/Documents`）
   - **モデル**: 接続後に利用可能なモデル一覧から選択
   - **推論性能**: Low / Medium / High / Extra High
   - **アクセス権限**: リクエスト時に承認（デフォルト）/ 自動承認 / 信頼されていないコードのみ承認
5. AMA で会話 → Codex がコーディング作業を実行して応答 → アバターが TTS で読み上げ

#### 注意事項

- Codex CLI はバックグラウンドで `codex app-server` を自動的に起動します。別途ターミナル作業は不要です。
- アクセス権限を「自動承認」に設定すると、Codex がファイルの変更/実行を自動で行います。**信頼できる環境でのみ使用**してください。
- Provider を他のモデルに切り替えると、Codex 接続は自動的に終了します。

---

## よくある問題

### 1) 音声認識ボタンが動作しない

- リモート接続状態か確認
- マイク権限の許可状況を確認
- Whisper モデル/ランタイムファイルのパスが正しいか確認
- グローバルショートカット使用中の場合、アクセシビリティ権限/ショートカット競合を確認

### 2) TTS の音が出ない

- 設定で TTS Test を実行しエラーメッセージを確認
- Supertonic モデル（`onnx`、`voice_styles`）のパスを確認

### 3) VRM ロード失敗

- 有効な `.vrm` ファイルか確認
- 設定 > アバターでファイルを再選択

---

## VRM ファイルの入手/購入ガイド

### 主要サイト

| サイト | タイプ | 特徴 |
|--------|--------|------|
| [VRoid Hub](https://hub.vroid.com/en/) | 無料中心（共有モデル） | 作者がダウンロードを許可したモデルを使用可能 |
| [BOOTH（VRM 検索）](https://booth.pm/en/search/VRM) | 無料 + 有料 | 個人クリエイターのモデル販売/配布が最も活発なマーケット |
| [VRoid Studio](https://vroid.com/en/studio/) | 自作（無料） | 自分でキャラクターを制作し `.vrm` でエクスポート可能 |

### VRM 使用前チェックリスト

- 商用利用可否
- 配信/動画アップロード許可
- 改変（修正）許可
- 再配布禁止条件
- クレジット表記条件

> 上記の VRM ガイドは参考用です。実際の使用前に各モデルの最新ライセンスと利用規約を必ず確認してください。

---

## アプリの削除

macOS から AMA を完全に削除するには:

1. `Applications` フォルダから `AMA.app` を削除
2. ダウンロードされたモデルデータを削除:
   ```bash
   rm -rf ~/.mypartnerai
   ```

> アプリ内の `設定 > データ管理` からもモデルデータを削除できます。

---

## 使用 AI/モデルライセンスおよびリンク

### AI サービス/ランタイム

| 項目 | 用途 | ライセンス/規約 | リンク |
|------|------|-----------------|--------|
| Ollama | ローカル LLM サーバー | MIT License | [github.com/ollama/ollama](https://github.com/ollama/ollama) |
| LocalAI | ローカル OpenAI 互換サーバー | MIT License | [github.com/mudler/LocalAI](https://github.com/mudler/LocalAI) |
| Claude API | クラウド LLM | Anthropic サービス規約 | [anthropic.com/claude](https://www.anthropic.com/claude) |
| OpenAI API | クラウド LLM | OpenAI サービス規約 | [platform.openai.com](https://platform.openai.com/) |
| Gemini API | クラウド LLM | Google サービス規約 | [ai.google.dev](https://ai.google.dev/) |
| OpenAI Codex CLI | コーディングエージェント | Apache 2.0 License | [github.com/openai/codex](https://github.com/openai/codex) |
| ONNX Runtime Web | Supertonic 推論ランタイム | MIT License | [github.com/microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) |

### 音声モデル/エンジン

| 項目 | 用途 | ライセンス | リンク |
|------|------|------------|--------|
| whisper.cpp | STT 実行エンジン | MIT License | [github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) |
| Whisper (OpenAI) | STT モデル原本 | MIT License | [github.com/openai/whisper](https://github.com/openai/whisper) |
| Supertonic コード | TTS エンジン実装 | MIT License | [github.com/supertone-inc/supertonic](https://github.com/supertone-inc/supertonic) |
| Supertonic モデル | ローカル TTS モデル | BigScience Open RAIL-M | [huggingface.co/Supertone/supertonic](https://huggingface.co/Supertone/supertonic) |

> クラウド AI（Claude/OpenAI/Gemini）は各サービス利用規約に従います。モデル/ランタイムの再配布時は各プロジェクトの最新 LICENSE を確認してください。

## デフォルトアバターの著作権

DMG 配布アプリに含まれるデフォルト VRM アバターは本プロジェクト著作権者の所有であり、**MIT ライセンスの適用対象ではありません。**

- 本アプリ内での使用のみ許可されます。
- 抽出、再配布、他のアプリ/サービスでの使用を禁止します。
- ソースコードリポジトリにはデフォルトアバターは含まれていません。

## ライセンス

MIT — デフォルトアバターを除くソースコードに適用されます。
