import type { ShellKind } from '../shared/messages';

export interface StartOpts {
  shell: ShellKind;
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

export interface ITerminalBackend {
  readonly mode: 'line' | 'raw';
  start(opts: StartOpts): void;
  runLine(line: string): void;
  write(data: string): void;
  signal(sig: 'stop'): void;
  resize(cols: number, rows: number): void;
  dispose(): void;
  onData(cb: (chunk: string) => void): void;
  onIdle(cb: (code: number | null, cwd: string | null) => void): void;
  onExit(cb: (code: number | null) => void): void;
}

export type BackendKind = 'spawn' | 'pty';

// Lazy require avoids a load-time cycle (impl files import this module).
export function createBackend(kind: BackendKind): ITerminalBackend {
  if (kind === 'pty') {
    const { PtyBackend } = require('./pty-backend');
    return new PtyBackend();
  }
  const { SpawnBackend } = require('./spawn-backend');
  return new SpawnBackend();
}
