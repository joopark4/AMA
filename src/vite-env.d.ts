/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_BACKEND_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_APPLE_CLIENT_ID: string;
  readonly VITE_META_APP_ID: string;
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_GOOGLE_API_KEY: string;
  readonly VITE_OLLAMA_ENDPOINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
