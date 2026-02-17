import React from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import App from './App';
import './index.css';
import './i18n';

window.addEventListener('error', (event) => {
  const message = `[WindowError] ${event.message}\n${event.filename}:${event.lineno}:${event.colno}`;
  console.error(message, event.error);
  invoke('log_to_terminal', { message }).catch(() => {});
});

window.addEventListener('unhandledrejection', (event) => {
  const reason =
    event.reason instanceof Error
      ? event.reason.stack || event.reason.message
      : String(event.reason);
  const message = `[UnhandledRejection] ${reason}`;
  console.error(message);
  invoke('log_to_terminal', { message }).catch(() => {});
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
