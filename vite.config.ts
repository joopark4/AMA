import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    fs: {
      // models 폴더에서 정적 파일 제공 허용
      allow: ['..', 'models', 'node_modules'],
    },
    headers: {
      // SharedArrayBuffer 사용을 위한 Cross-Origin Isolation 헤더
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        // WASM 파일을 별도로 분리
        manualChunks: {
          'onnx': ['onnxruntime-web'],
        },
      },
    },
  },
  // WASM 모듈 특수 처리
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  // WASM 파일 처리
  assetsInclude: ['**/*.wasm'],
  worker: {
    format: 'es',
  },
});
