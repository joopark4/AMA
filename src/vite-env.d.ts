/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_GOOGLE_API_KEY: string;
  readonly VITE_OLLAMA_ENDPOINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
