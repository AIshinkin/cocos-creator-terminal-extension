export const PKG = 'terminal';

export const MSG = {
  OPEN_SESSION: 'open-session',
  RUN: 'run',
  INPUT: 'input',
  RESIZE: 'resize',
  SIGNAL: 'signal',
  SET_SHELL: 'set-shell',
  CLOSE_SESSION: 'close-session',
  SAVE_TABS: 'save-tabs',
  LOAD_TABS: 'load-tabs',
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

// Panel state stashed in the main process so tabs survive a panel re-dock /
// reopen (the main process outlives the panel; backend shells stay alive).
export interface SavedTab {
  sessionId: string;
  title: string;
  color: string | null;
  mode: BackendMode;
  running: boolean;
  cwd: string;
  snapshot: string; // xterm SerializeAddon output (screen + scrollback)
}
export interface SavedPanelState { tabs: SavedTab[]; activeId: string | null; }
