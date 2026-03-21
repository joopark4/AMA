#!/usr/bin/env tsx
/**
 * 양방향 개발 브리지 채널 — Claude Code Channels 스펙 준수
 *
 * NOTE: Canonical source is `claude-plugin/ama-bridge/server.ts`.
 * This file is kept for backward compatibility with existing installations.
 * When making changes, update the canonical source first.
 *
 * AMA 또는 외부에서 질문을 보내면 Claude Code에 채널 알림으로 전달되고,
 * Claude가 reply 도구로 응답하면 HTTP 응답 + AMA TTS로 출력된다.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { PORTS } from './shared/config.mts';
// speak import 제거 — AMA가 HTTP 응답으로 직접 TTS 처리

// --- Pending reply 관리 (24시간 타임아웃, 새 입력 시 전체 갱신, 최대 50개) ---
import { randomUUID } from 'node:crypto';

const TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24시간
const MAX_PENDING = 50;

interface PendingReply {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingReplies = new Map<string, PendingReply>();

/** 모든 대기 중인 요청의 타임아웃을 24시간으로 갱신 */
function refreshAllTimeouts(): void {
  for (const [id, pending] of pendingReplies) {
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {
      pendingReplies.delete(id);
      pending.reject(new Error('Session timeout (24h inactivity)'));
    }, TIMEOUT_MS);
  }
}

function createPendingReply(): { id: string; promise: Promise<string> } {
  // 최대 개수 제한 — 가장 오래된 것부터 제거
  if (pendingReplies.size >= MAX_PENDING) {
    const oldest = pendingReplies.keys().next().value;
    if (oldest) {
      const old = pendingReplies.get(oldest);
      if (old) {
        clearTimeout(old.timer);
        old.reject(new Error('Queue full'));
      }
      pendingReplies.delete(oldest);
    }
  }

  const id = randomUUID(); // 예측 불가능한 ID
  const promise = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingReplies.delete(id);
      reject(new Error('Session timeout (24h inactivity)'));
    }, TIMEOUT_MS);
    pendingReplies.set(id, { resolve, reject, timer });
  });

  // 새 입력 → 기존 대기 요청 타임아웃 갱신
  refreshAllTimeouts();

  return { id, promise };
}

// --- Channel 서버 (공식 스펙) ---
const mcp = new Server(
  { name: 'ama-bridge', version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions: [
      'Messages from the ama-bridge channel arrive as <channel source="ama-bridge" question_id="...">.',
      'These are questions from the AMA avatar app user.',
      'You MUST reply using the "reply" tool, passing back the question_id from the tag.',
      'Include an emotion field in your reply (happy, sad, thinking, surprised, relaxed, angry, neutral).',
      'The reply will be spoken aloud by the AMA avatar via TTS.',
      'Keep replies concise (2-3 sentences) and conversational.',
    ].join(' '),
  },
);

// reply 도구 등록 (공식 스펙: ListToolsRequestSchema + CallToolRequestSchema)
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: 'Reply to the AMA avatar user. The response will be spoken aloud by the avatar via TTS.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        question_id: { type: 'string', description: 'The question_id from the channel tag to reply to' },
        text: { type: 'string', description: 'The reply text (will be spoken by TTS, keep concise)' },
        emotion: { type: 'string', description: 'Avatar emotion: happy, sad, thinking, surprised, relaxed, angry, neutral' },
      },
      required: ['question_id', 'text'],
    },
  }],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== 'reply') {
    throw new Error(`Unknown tool: ${req.params.name}`);
  }

  const { question_id, text, emotion } = req.params.arguments as {
    question_id: string; text: string; emotion?: string;
  };

  const pending = pendingReplies.get(question_id);
  if (!pending) {
    return {
      content: [{ type: 'text' as const, text: `No pending question with id ${question_id}` }],
      isError: true,
    };
  }

  clearTimeout(pending.timer);
  pendingReplies.delete(question_id);
  pending.resolve(text);

  // AMA는 HTTP 응답을 통해 직접 TTS를 처리하므로 여기서는 /speak 호출 불필요
  // (호출하면 useConversation + useMcpSpeakListener 양쪽에서 이중 재생됨)

  return {
    content: [{ type: 'text' as const, text: `Reply sent to question ${question_id}` }],
  };
});

// --- HTTP 서버 ---
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', pending: pendingReplies.size }));
    return;
  }

  // 채널 연결 테스트: 테스트 알림 → reply 대기 (5초 타임아웃)
  if (req.method === 'POST' && req.url === '/channel-test') {
    const { id, promise } = createPendingReply();

    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: '[channel-test] ping',
        meta: { question_id: id },
      },
    });

    try {
      const reply = await Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        ),
      ]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ channel: true, reply }));
    } catch {
      // 타임아웃 — pending 정리
      const pending = pendingReplies.get(id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingReplies.delete(id);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ channel: false }));
    }
    return;
  }

  // 다른 인스턴스가 포트를 인수받기 위한 종료 요청
  if (req.method === 'POST' && req.url === '/shutdown') {
    console.error('[ama-bridge] Shutdown requested by new instance — exiting');
    res.writeHead(200).end('ok');
    setTimeout(() => process.exit(0), 200);
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of req) {
    totalSize += (chunk as Buffer).length;
    if (totalSize > 8192) {
      res.writeHead(413).end('Payload Too Large');
      return;
    }
    chunks.push(chunk as Buffer);
  }

  const rawBody = Buffer.concat(chunks).toString('utf-8');

  // JSON 또는 plain text
  let question: string;
  let context: string | undefined;
  try {
    const parsed = JSON.parse(rawBody) as { question?: string; text?: string; context?: string };
    question = parsed.question ?? parsed.text ?? rawBody;
    context = parsed.context;
  } catch {
    question = rawBody;
  }

  if (!question.trim()) {
    res.writeHead(400).end('Empty question');
    return;
  }

  const { id, promise } = createPendingReply();

  // Claude Code에 채널 알림 (공식 스펙: notifications/claude/channel)
  const contentParts = [question.trim()];
  if (context) contentParts.push(`\n\n[Conversation context]\n${context}`);

  await mcp.notification({
    method: 'notifications/claude/channel',
    params: {
      content: contentParts.join(''),
      meta: {
        question_id: id,
      },
    },
  });

  try {
    const reply = await promise;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id, reply }));
  } catch (err) {
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id, error: (err as Error).message }));
  }
});

// --- 시작 (포트 충돌 시 기존 서버 종료 후 재바인딩) ---
const port = PORTS.DEV_BRIDGE;

async function tryListen(): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.once('error', async (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[ama-bridge] Port ${port} in use — killing old server and retrying...`);
        try {
          // 기존 서버에 종료 요청
          const res = await fetch(`http://127.0.0.1:${port}/shutdown`, { method: 'POST' }).catch(() => null);
          if (!res) {
            await new Promise(r => setTimeout(r, 1000));
          }
          // 재시도
          httpServer.listen(port, '127.0.0.1', () => {
            console.error(`[ama-bridge] HTTP server listening on 127.0.0.1:${port} (after retry)`);
            resolve();
          });
        } catch {
          reject(new Error(`Port ${port} still in use after retry`));
        }
      } else {
        reject(err);
      }
    });

    httpServer.listen(port, '127.0.0.1', () => {
      console.error(`[ama-bridge] HTTP server listening on 127.0.0.1:${port}`);
      resolve();
    });
  });
}

await tryListen();

await mcp.connect(new StdioServerTransport());
console.error('[ama-bridge] Channel connected via stdio');
