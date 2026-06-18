export const PKG = 'terminal';

export const MSG = {
  OPEN_SESSION: 'open-session',
  RUN: 'run',
  INPUT: 'input',
  RESIZE: 'resize',
  SIGNAL: 'signal',
  SET_SHELL: 'set-shell',
  CLOSE_SESSION: 'close-session',
} as const;

export type BackendMode = 'raw' | 'line';

// Messages routed from the main process to the panel. Declared in
// contributions.messages with target "default.<method>" and delivered via
// Editor.Message.send(PKG, name, payload).
export const TO_PANEL = {
  DATA: 'data',
  IDLE: 'idle',
  EXIT: 'exit',
} as const;

export type ShellKind = 'powershell' | 'cmd' | 'bash';

export interface DataPayload { sessionId: string; chunk: string; }
export interface IdlePayload { sessionId: string; code: number | null; cwd: string | null; }
export interface ExitPayload { sessionId: string; code: number | null; }
