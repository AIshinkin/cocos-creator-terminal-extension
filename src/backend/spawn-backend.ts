import { spawn as nodeSpawn } from 'node:child_process';
import type { ITerminalBackend, StartOpts } from './types';
import { SHELLS, buildCommand } from './shells';
import { scanSentinel } from '../shared/sentinel';

type SpawnLike = typeof nodeSpawn;

export class SpawnBackend implements ITerminalBackend {
  readonly mode = 'line' as const;
  private child: ReturnType<SpawnLike> | null = null;
  private opts: StartOpts | null = null;
  private buf = '';
  private dataCb: (chunk: string) => void = () => {};
  private idleCb: (code: number | null, cwd: string | null) => void = () => {};
  private exitCb: (code: number | null) => void = () => {};

  constructor(private spawnFn: SpawnLike = nodeSpawn) {}

  start(opts: StartOpts): void {
    this.opts = opts;
    const spec = SHELLS[opts.shell] ?? SHELLS.powershell;
    this.buf = '';
    let child: ReturnType<SpawnLike>;
    try {
      child = this.spawnFn(spec.file, spec.args, {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        windowsHide: true,
      });
    } catch (err: any) {
      this.dataCb(`\r\n[terminal] failed to start ${spec.file}: ${err?.message ?? err}\r\n`);
      return;
    }
    this.child = child;
    const onChunk = (d: Buffer | string) => this.handle(d.toString());
    child.stdout?.on('data', onChunk);
    child.stderr?.on('data', onChunk);
    child.on('exit', (code) => this.exitCb(code));
    child.on('error', (err: any) =>
      this.dataCb(`\r\n[terminal] ${spec.file}: ${err?.message ?? err}\r\n`));
  }

  private handle(text: string): void {
    this.buf += text;
    for (;;) {
      const { display, result, remainder } = scanSentinel(this.buf);
      if (display) this.dataCb(display);
      this.buf = remainder;
      if (!result) break;
      this.idleCb(result.code, result.cwd);
    }
  }

  runLine(line: string): void {
    if (!this.child || !this.opts) return;
    const spec = SHELLS[this.opts.shell] ?? SHELLS.powershell;
    this.child.stdin?.write(buildCommand(spec, line));
  }

  write(data: string): void { this.child?.stdin?.write(data); }

  signal(_sig: 'stop'): void {
    const opts = this.opts;
    this.child?.kill();
    this.child = null;
    if (opts) this.start(opts);
  }

  resize(_cols: number, _rows: number): void { /* no-op in line mode */ }

  dispose(): void { this.child?.kill(); this.child = null; }

  onData(cb: (chunk: string) => void): void { this.dataCb = cb; }
  onIdle(cb: (code: number | null, cwd: string | null) => void): void { this.idleCb = cb; }
  onExit(cb: (code: number | null) => void): void { this.exitCb = cb; }
}
