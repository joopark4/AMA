import React from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ErrorBoundaryProps {
  name: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const header = `[ErrorBoundary:${this.props.name}]`;
    const stack = error?.stack || error?.message || String(error);
    const componentStack = errorInfo.componentStack || '';
    const message = `${header} ${stack}\n${componentStack}`;

    console.error(header, error, errorInfo);
    invoke('log_to_terminal', { message }).catch(() => {});
  }

  componentDidUpdate(prevProps: Readonly<ErrorBoundaryProps>): void {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
