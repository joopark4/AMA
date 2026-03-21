#!/usr/bin/env node
/**
 * AMA dev-bridge를 Claude Code 글로벌 설정에 등록/해제하는 스크립트
 *
 * 등록: node mcp-channels/install-global.mjs
 * 해제: node mcp-channels/install-global.mjs --uninstall
 *
 * 등록 후 모든 디렉토리의 Claude Code 세션에서 dev-bridge 사용 가능
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const CLAUDE_JSON_PATH = join(HOME, '.claude.json');
const MCP_INSTALL_DIR = join(HOME, '.mypartnerai', 'mcp-channels');
const SERVER_KEY = 'ama-bridge';

const isUninstall = process.argv.includes('--uninstall');

// --- 1. mcp-channels를 ~/.mypartnerai/mcp-channels/에 복사 ---
function installFiles() {
  const sourceDir = resolve(import.meta.dirname || '.', '.');

  if (!existsSync(join(sourceDir, 'package.json'))) {
    console.error('[ERROR] mcp-channels/package.json을 찾을 수 없습니다.');
    console.error('        프로젝트 루트에서 실행: node mcp-channels/install-global.mjs');
    process.exit(1);
  }

  // 설치 디렉토리 생성
  mkdirSync(MCP_INSTALL_DIR, { recursive: true });

  // 파일 복사
  const filesToCopy = [
    'package.json',
    'tsconfig.json',
    'dev-bridge.mts',
    'shared/config.mts',
    'shared/ama-client.mts',
  ];

  mkdirSync(join(MCP_INSTALL_DIR, 'shared'), { recursive: true });

  for (const file of filesToCopy) {
    const src = join(sourceDir, file);
    const dst = join(MCP_INSTALL_DIR, file);
    if (existsSync(src)) {
      cpSync(src, dst, { force: true });
      console.log(`  복사: ${file}`);
    }
  }

  // node_modules 복사 (또는 npm install 실행)
  const srcModules = join(sourceDir, 'node_modules');
  const dstModules = join(MCP_INSTALL_DIR, 'node_modules');
  if (existsSync(srcModules) && !existsSync(dstModules)) {
    console.log('  node_modules 복사 중...');
    cpSync(srcModules, dstModules, { recursive: true, force: true });
  }

  console.log(`\n[OK] 파일 설치 완료: ${MCP_INSTALL_DIR}`);
}

// --- 2. Claude Code 글로벌 설정에 등록 ---
function registerInClaudeSettings() {
  let settings = {};
  if (existsSync(CLAUDE_JSON_PATH)) {
    try {
      settings = JSON.parse(readFileSync(CLAUDE_JSON_PATH, 'utf-8'));
    } catch {
      console.warn('[WARN] 기존 ~/.claude.json 파싱 실패, 새로 생성합니다.');
    }
  }

  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }

  settings.mcpServers[SERVER_KEY] = {
    type: 'stdio',
    command: 'npx',
    args: [
      '--prefix', MCP_INSTALL_DIR,
      'tsx',
      join(MCP_INSTALL_DIR, 'dev-bridge.mts'),
    ],
    env: {},
  };

  writeFileSync(CLAUDE_JSON_PATH, JSON.stringify(settings, null, 2) + '\n');
  console.log(`[OK] Claude Code 글로벌 설정 등록 완료: ${CLAUDE_JSON_PATH}`);
  console.log(`     서버 이름: ${SERVER_KEY}`);
  console.log(`     포트: 8790`);
  console.log('\n이제 어디서든 claude 명령을 실행하면 dev-bridge가 자동 시작됩니다.');
}

// --- 3. 해제 ---
function unregister() {
  if (!existsSync(CLAUDE_JSON_PATH)) {
    console.log('Claude Code 설정 파일이 없습니다.');
    return;
  }

  let settings = {};
  try {
    settings = JSON.parse(readFileSync(CLAUDE_JSON_PATH, 'utf-8'));
  } catch {
    console.error('[ERROR] settings.json 파싱 실패');
    return;
  }

  if (settings.mcpServers?.[SERVER_KEY]) {
    delete settings.mcpServers[SERVER_KEY];
    writeFileSync(CLAUDE_JSON_PATH, JSON.stringify(settings, null, 2) + '\n');
    console.log(`[OK] Claude Code 글로벌 설정에서 ${SERVER_KEY} 제거 완료`);
  } else {
    console.log(`${SERVER_KEY}가 등록되어 있지 않습니다.`);
  }
}

// --- 실행 ---
if (isUninstall) {
  console.log('=== AMA dev-bridge 글로벌 해제 ===\n');
  unregister();
} else {
  console.log('=== AMA dev-bridge 글로벌 설치 ===\n');
  installFiles();
  registerInClaudeSettings();
}
