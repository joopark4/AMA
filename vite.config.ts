import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { URL } from 'url';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

/**
 * Dev-only Vite plugin: receives OAuth callback on localhost
 * so deep-link is not needed during `tauri dev`.
 *
 * Flow:
 *  1. Browser redirects to http://localhost:1420/auth/callback?code=XXX
 *  2. This middleware captures the code and returns a "success" HTML page
 *  3. The Tauri app polls GET /api/auth-code to retrieve the code
 */
function devOAuthCallbackPlugin(): Plugin {
  let pendingCode: string | null = null;

  return {
    name: 'dev-oauth-callback',
    apply: 'serve', // dev server only
    configureServer(server) {
      // Capture OAuth callback
      server.middlewares.use('/auth/callback', (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const url = new URL(req.url!, 'http://localhost');
          const code = url.searchParams.get('code');
          if (code) {
            pendingCode = code;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html><html><head><title>AMA</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f8fafc">
<div style="text-align:center"><h2>Login successful</h2><p style="color:#6b7280">You can close this tab and return to AMA.</p></div>
</body></html>`);
            return;
          }
        } catch { /* fall through */ }
        next();
      });

      // Poll endpoint for the Tauri app
      server.middlewares.use('/api/auth-code', (_req, res) => {
        const code = pendingCode;
        pendingCode = null;
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ code }));
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), devOAuthCallbackPlugin()],
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
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    rollupOptions: {
      output: {
        // WASM 파일을 별도로 분리
        manualChunks: {
          'onnx': ['onnxruntime-web'],
        },
      },
    },
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  // WASM 모듈 특수 처리
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  // WASM 파일 처리
  assetsInclude: ['**/*.wasm'],
  worker: {
    format: 'es',
  },
});
