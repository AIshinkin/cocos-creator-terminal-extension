import type { ITerminalBackend, BackendKind } from './backend/types';
import { createBackend } from './backend/types';
import type { ShellKind, BackendMode } from './shared/messages';

export interface SessionEvents {
  onData(sessionId: string, chunk: string): void;
  onIdle(sessionId: string, code: number | null, cwd: string | null): void;
  onExit(sessionId: string, code: number | null): void;
}

export class SessionManager {
  private sessions = new Map<string, ITerminalBackend>();

  constructor(
    private events: SessionEvents,
    private backendFactory: (k: BackendKind) => ITerminalBackend = createBackend,
  ) {}

  // Prefers a real PTY; falls back to the piped-shell (line mode) backend if the
  // pty native module is unavailable. Returns the active mode so the panel can
  // adapt its input handling.
  open(sessionId: string, shell: ShellKind, cwd: string): BackendMode {
    this.close(sessionId);
    const wire = (b: ITerminalBackend) => {
      b.onData((c) => this.events.onData(sessionId, c));
      b.onIdle((code, w) => this.events.onIdle(sessionId, code, w));
      b.onExit((code) => this.events.onExit(sessionId, code));
    };

    let pending: ITerminalBackend | undefined;
    let backend: ITerminalBackend;
    try {
      pending = this.backendFactory('pty');
      wire(pending);
      pending.start({ shell, cwd });
      backend = pending;
    } catch {
      try { pending?.dispose(); } catch { /* ignore */ }
      backend = this.backendFactory('spawn');
      wire(backend);
      backend.start({ shell, cwd });
    }

    this.sessions.set(sessionId, backend);
    return backend.mode;
  }

  run(sessionId: string, line: string): void { this.sessions.get(sessionId)?.runLine(line); }
  write(sessionId: string, data: string): void { this.sessions.get(sessionId)?.write(data); }
  resize(sessionId: string, cols: number, rows: number): void { this.sessions.get(sessionId)?.resize(cols, rows); }
  signal(sessionId: string, sig: 'stop'): void { this.sessions.get(sessionId)?.signal(sig); }
  setShell(sessionId: string, shell: ShellKind, cwd: string): BackendMode { return this.open(sessionId, shell, cwd); }

  close(sessionId: string): void {
    const b = this.sessions.get(sessionId);
    if (b) { b.dispose(); this.sessions.delete(sessionId); }
  }

  disposeAll(): void {
    for (const b of this.sessions.values()) b.dispose();
    this.sessions.clear();
  }
}
