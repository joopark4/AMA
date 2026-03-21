#!/usr/bin/env tsx
/**
 * CI/CD 웹훅 채널 — Claude Code Channels 스펙 준수
 *
 * GitHub Actions workflow_run 이벤트를 수신하여
 * Claude Code에 채널 알림을 보내고, AMA 아바타가 음성으로 알려준다.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PORTS } from './shared/config.mts';
import { speak } from './shared/ama-client.mts';

// --- HMAC-SHA256 검증 ---
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? '';

function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!WEBHOOK_SECRET || !signature) return !WEBHOOK_SECRET;
  const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// --- GitHub 이벤트 파싱 ---
interface WebhookEvent {
  event_type: string;
  repo: string;
  action: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  url?: string;
}

function parseGithubEvent(eventType: string, body: Record<string, unknown>): WebhookEvent {
  const repo = (body.repository as Record<string, unknown>)?.full_name as string ?? 'unknown';

  if (eventType === 'workflow_run') {
    const wr = body.workflow_run as Record<string, unknown>;
    const name = wr?.name as string ?? 'workflow';
    const conclusion = wr?.conclusion as string ?? 'unknown';
    const branch = wr?.head_branch as string ?? '';
    const url = wr?.html_url as string ?? '';
    const isFailed = conclusion === 'failure';

    return {
      event_type: eventType, repo, action: conclusion,
      severity: isFailed ? 'critical' : 'info',
      summary: isFailed
        ? `${repo} build failed: "${name}" (${branch}) — ${url}`
        : `${repo} build succeeded: "${name}" (${branch})`,
      url,
    };
  }

  if (eventType === 'push') {
    const commits = (body.commits as unknown[])?.length ?? 0;
    const ref = body.ref as string ?? '';
    return {
      event_type: eventType, repo, action: 'push', severity: 'info',
      summary: `${commits} commit(s) pushed to ${repo} (${ref})`,
    };
  }

  return {
    event_type: eventType, repo, action: body.action as string ?? eventType,
    severity: 'info', summary: `${repo}: ${eventType} event received`,
  };
}

// --- Channel 서버 (공식 스펙) ---
const mcp = new Server(
  { name: 'ci-webhook', version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
    },
    instructions: [
      'Events from the ci-webhook channel arrive as <channel source="ci-webhook" ...>.',
      'They are CI/CD webhook events from GitHub Actions.',
      'Attributes include: event_type, repo, action, severity, url.',
      'severity=critical means a build failed — analyze the failure and suggest fixes.',
      'severity=info is informational — acknowledge briefly.',
      'This is a one-way channel: read events and act, no reply expected.',
    ].join(' '),
  },
);

// --- HTTP 웹훅 서버 ---
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of req) {
    totalSize += (chunk as Buffer).length;
    if (totalSize > 1_048_576) { // 1MB 제한
      res.writeHead(413).end('Payload Too Large');
      return;
    }
    chunks.push(chunk as Buffer);
  }
  const rawBody = Buffer.concat(chunks).toString('utf-8');

  const sig = req.headers['x-hub-signature-256'] as string | undefined;
  if (!verifySignature(rawBody, sig)) {
    res.writeHead(403).end('Invalid signature');
    return;
  }

  try {
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = (req.headers['x-github-event'] as string) ?? 'unknown';
    const event = parseGithubEvent(eventType, body);

    // Claude Code에 채널 알림 (공식 스펙: notifications/claude/channel)
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: event.summary,
        meta: {
          event_type: event.event_type,
          repo: event.repo,
          action: event.action,
          severity: event.severity,
          ...(event.url ? { url: event.url } : {}),
        },
      },
    });

    // AMA 아바타 음성 알림 (빌드 실패 등 중요 이벤트)
    if (event.severity === 'critical' || event.severity === 'warning') {
      await speak(event.summary, 'ci-webhook', {
        priority: event.severity === 'critical' ? 'urgent' : 'normal',
        emotion: event.severity === 'critical' ? 'surprised' : 'thinking',
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, event_type: eventType }));
  } catch (err) {
    console.error('[ci-webhook] Parse error:', err);
    res.writeHead(400).end('Bad Request');
  }
});

// --- 시작 ---
const port = PORTS.CI_WEBHOOK;
httpServer.listen(port, '127.0.0.1', () => {
  console.error(`[ci-webhook] HTTP server listening on 127.0.0.1:${port}`);
});

await mcp.connect(new StdioServerTransport());
console.error('[ci-webhook] Channel connected via stdio');
