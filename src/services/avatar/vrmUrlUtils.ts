/**
 * vrmUrlUtils — VRM 모델 경로 해석 유틸리티
 */

import { convertFileSrc, isTauri } from '@tauri-apps/api/core';

export function isAbsoluteFilePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

export function isFileUrl(path: string): boolean {
  return /^file:\/\//i.test(path.trim());
}

export function isLocalFileSource(path: string): boolean {
  const trimmed = path.trim();
  return isAbsoluteFilePath(trimmed) || isFileUrl(trimmed);
}

export function toFsReadTarget(path: string): string | URL {
  const trimmed = path.trim();
  return isFileUrl(trimmed) ? new URL(trimmed) : trimmed;
}

export function resolveModelUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed) || /^asset:\/\//i.test(trimmed) ||
      /^tauri:\/\//i.test(trimmed) || /^blob:/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/vrm/')) return trimmed;

  if (isAbsoluteFilePath(trimmed)) {
    if (isTauri()) return convertFileSrc(trimmed);
    if (trimmed.startsWith('/')) return `file://${trimmed}`;
    return `file:///${trimmed.replace(/\\/g, '/')}`;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
