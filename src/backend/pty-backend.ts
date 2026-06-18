import type { ITerminalBackend, StartOpts } from './types';
import { SHELLS } from './shells';

/**
 * Real PTY backend using @lydell/node-pty (N-API prebuilt — loads in the editor's
 * Electron without a compiler). Runs in 'raw' mode: xterm pipes keystrokes straight
 * to the pty, the shell echoes and prints its own prompt, real SIGINT works, and
 * interactive programs (claude, vim, ssh) behave correctly.
 */
export class PtyBackend implements ITerminalBackend {
  readonly mode = 'raw' as const;
  private ptyMod: any;
  private pty: any = null;
  private opts: StartOpts | null = null;
  private cols = 80;
  private rows = 24;
  private dataCb: (chunk: string) => void = () => {};
  private idleCb: (code: number | null, cwd: string | null) => void = () => {};
  private exitCb: (code: number | null) => void = () => {};

  // ptyMod injectable for tests; defaults to the real module (throws if the
  // native binary is unavailable, letting SessionManager fall back to spawn).
  constructor(ptyMod?: any) {
    this.ptyMod = ptyMod ?? require('@lydell/node-pty');
  }

  start(opts: StartOpts): void {
    this.opts = opts;
    const spec = SHELLS[opts.shell] ?? SHELLS.powershell;
    this.pty = this.ptyMod.spawn(spec.file, spec.ptyArgs, {
      name: 'xterm-color',
      cols: this.cols,
      rows: this.rows,
      cwd: opts.cwd,
      env: (opts.env ?? process.env) as any,
    });
    this.pty.onData((d: string) => this.dataCb(d));
    this.pty.onExit((e: { exitCode: number }) => this.exitCb(e ? e.exitCode : null));
  }

  // In raw mode write() is the primary input path; runLine is kept for interface
  // parity (appends a carriage return so a programmatic command executes).
  write(data: string): void { this.pty?.write(data); }
  runLine(line: string): void { this.pty?.write(line + '\r'); }

  signal(_sig: 'stop'): void { this.pty?.write('\x03'); } // real Ctrl+C

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    try { this.pty?.resize(cols, rows); } catch { /* pty may have exited */ }
  }

  dispose(): void {
    try { this.pty?.kill(); } catch { /* already dead */ }
    this.pty = null;
  }

  onData(cb: (chunk: string) => void): void { this.dataCb = cb; }
  onIdle(cb: (code: number | null, cwd: string | null) => void): void { this.idleCb = cb; }
  onExit(cb: (code: number | null) => void): void { this.exitCb = cb; }
}
