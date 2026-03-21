#!/usr/bin/env bash
# MCP 채널 + AMA TTS 통합 테스트 스크립트
#
# 사용법:
#   1. AMA 앱 실행 (npm run tauri dev)
#   2. ./mcp-channels/test-channels.sh
#
set -euo pipefail

TOKEN_FILE="${HOME}/.mypartnerai/mcp-token"

echo "=== AMA MCP 채널 테스트 ==="
echo ""

# 1. 토큰 확인
if [ -f "$TOKEN_FILE" ]; then
  TOKEN=$(cat "$TOKEN_FILE")
  echo "[OK] 토큰 파일 존재: $TOKEN_FILE"
else
  echo "[SKIP] 토큰 파일 없음 — AMA 앱이 실행 중인지 확인하세요"
  TOKEN=""
fi

# 2. AMA Health Check
echo ""
echo "--- AMA Health Check (127.0.0.1:8791) ---"
if curl -sf http://127.0.0.1:8791/health 2>/dev/null; then
  echo ""
  echo "[OK] AMA 리스너 가동 중"
else
  echo "[WARN] AMA 리스너 미응답 — 앱이 실행 중인지 확인하세요"
fi

# 3. AMA /speak 직접 테스트
if [ -n "$TOKEN" ]; then
  echo ""
  echo "--- AMA /speak 직접 테스트 ---"
  curl -s -X POST http://127.0.0.1:8791/speak \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"text":"테스트 메시지입니다. MCP 채널에서 보낸 알림이에요.","source":"test","emotion":"happy"}' \
    && echo ""
fi

# 4. CI 웹훅 테스트 (포트 8788)
echo ""
echo "--- CI 웹훅 테스트 (127.0.0.1:8788) ---"
curl -s -X POST http://127.0.0.1:8788 \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: workflow_run" \
  -d '{
    "workflow_run": {
      "name": "Release",
      "conclusion": "failure",
      "head_branch": "main",
      "html_url": "https://github.com/joopark4/MyPartnerAI/actions/runs/123"
    },
    "repository": { "full_name": "joopark4/MyPartnerAI" }
  }' 2>/dev/null && echo "" || echo "[SKIP] CI 웹훅 서버 미실행"

# 5. 모니터링 알림 테스트 (포트 8789)
echo ""
echo "--- 모니터링 알림 테스트 (127.0.0.1:8789) ---"
curl -s -X POST http://127.0.0.1:8789 \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "high",
    "category": "edge-function",
    "message": "supertone-tts 429 에러 발생"
  }' 2>/dev/null && echo "" || echo "[SKIP] 모니터링 서버 미실행"

# 6. 개발 브리지 테스트 (포트 8790)
echo ""
echo "--- 개발 브리지 Health Check (127.0.0.1:8790) ---"
curl -sf http://127.0.0.1:8790/health 2>/dev/null && echo "" || echo "[SKIP] 브리지 서버 미실행"

echo ""
echo "=== 테스트 완료 ==="
