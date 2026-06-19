import { SessionManager } from './session-manager';
import { PKG, TO_PANEL, type ShellKind, type SavedPanelState } from './shared/messages';

let manager: SessionManager | null = null;

// Tab snapshot kept in the main process so the panel can be re-docked or
// reopened without losing its sessions. Backend shells live in `manager` and
// are not closed when the panel goes away — only on explicit tab close or
// extension unload.
let panelState: SavedPanelState | null = null;

export const methods = {
  openPanel(): void { Editor.Panel.open('terminal'); },
  openSession(sessionId: string, shell: ShellKind, cwd: string): string {
    return manager?.open(sessionId, shell, cwd) ?? 'line';
  },
  run(sessionId: string, line: string): void { manager?.run(sessionId, line); },
  input(sessionId: string, data: string): void { manager?.write(sessionId, data); },
  resize(sessionId: string, cols: number, rows: number): void { manager?.resize(sessionId, cols, rows); },
  signal(sessionId: string, sig: 'stop'): void { manager?.signal(sessionId, sig); },
  setShell(sessionId: string, shell: ShellKind, cwd: string): string {
    return manager?.setShell(sessionId, shell, cwd) ?? 'line';
  },
  closeSession(sessionId: string): void { manager?.close(sessionId); },
  saveTabs(state: SavedPanelState): void { panelState = state; },
  loadTabs(): SavedPanelState | null { return panelState; },
};

export function load(): void {
  manager = new SessionManager({
    onData: (id, chunk) => Editor.Message.send(PKG, TO_PANEL.DATA, { sessionId: id, chunk }),
    onIdle: (id, code, cwd) => Editor.Message.send(PKG, TO_PANEL.IDLE, { sessionId: id, code, cwd }),
    onExit: (id, code) => Editor.Message.send(PKG, TO_PANEL.EXIT, { sessionId: id, code }),
  });
}

export function unload(): void { manager?.disposeAll(); manager = null; panelState = null; }
