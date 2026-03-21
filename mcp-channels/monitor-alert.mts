#!/usr/bin/env tsx
/**
 * 모니터링 알림 채널 — Claude Code Channels 스펙 준수
 *
 * 에러/경고 알림 JSON을 수신하여 Claude Code에 전달하고,
 * 심각도가 높으면 AMA 아바타가 긴급 음성으로 알려준다.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { PORTS } from './shared/config.mts';
import { speak } from './shared/ama-client.mts';

// --- IP 허용 목록 ---
const ALLOWED_SOURCES = (process.env.ALLOWED_ALERT_SOURCES ?? '127.0.0.1,::1,::ffff:127.0.0.1')
  .split(',')
  .map((s) => s.trim());

function isAllowedSource(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  return ALLOWED_SOURCES.some((a) => remoteAddress === a || remoteAddress.endsWith(a));
}

// --- 알림 타입 ---
interface AlertPayload {
  severity: 'info' | 'warning' | 'high' | 'critical';
  category: string;
  message: string;
  source_file?: string;
  error_code?: string;
}

// --- Channel 서버 (공식 스펙) ---
const mcp = new Server(
  { name: 'monitor-alert', version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
    },
    instructions: [
      'Events from the monitor-alert channel arrive as <channel source="monitor-alert" ...>.',
      'They are monitoring alerts with attributes: severity, category, source_file, error_code.',
      'severity=critical or severity=high: analyze the root cause, suggest code fixes.',
      'severity=warning or severity=info: acknowledge and note for context.',
      'This is a one-way channel: read alerts and act, no reply expected.',
    ].join(' '),
  },
);

// --- HTTP 서버 ---
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  if (!isAllowedSource(req.socket.remoteAddress)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of req) {
    totalSize += (chunk as Buffer).length;
    if (totalSize > 4096) {
      res.writeHead(413).end('Payload Too Large');
      return;
    }
    chunks.push(chunk as Buffer);
  }

  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as AlertPayload;

    if (!body.severity || !body.message) {
      res.writeHead(400).end('Missing required fields: severity, message');
      return;
    }

    // Claude Code에 채널 알림 (공식 스펙)
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: body.message,
        meta: {
          severity: body.severity,
          category: body.category ?? 'unknown',
          ...(body.source_file ? { source_file: body.source_file } : {}),
          ...(body.error_code ? { error_code: body.error_code } : {}),
          timestamp: new Date().toISOString(),
        },
      },
    });

    // AMA 아바타 긴급 음성 알림 (critical/high)
    if (body.severity === 'critical' || body.severity === 'high') {
      await speak(body.message, 'monitor-alert', {
        priority: body.severity === 'critical' ? 'urgent' : 'normal',
        emotion: body.severity === 'critical' ? 'angry' : 'surprised',
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('[monitor-alert] Parse error:', err);
    res.writeHead(400).end('Bad Request');
  }
});

// --- 시작 ---
const port = PORTS.MONITOR_ALERT;
httpServer.listen(port, '127.0.0.1', () => {
  console.error(`[monitor-alert] HTTP server listening on 127.0.0.1:${port}`);
});

await mcp.connect(new StdioServerTransport());
console.error('[monitor-alert] Channel connected via stdio');
