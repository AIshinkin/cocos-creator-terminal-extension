import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PtyBackend } from '../src/backend/pty-backend';

function fakePtyModule() {
  const created: any[] = [];
  const mod = {
    spawn(file: string, args: string[], opts: any) {
      const p: any = {
        file, args, opts, writes: [], killed: false, cols: opts.cols, rows: opts.rows,
        _data: (_: string) => {}, _exit: (_: any) => {},
        onData(cb: any) { p._data = cb; },
        onExit(cb: any) { p._exit = cb; },
        write(d: string) { p.writes.push(d); },
        resize(c: number, r: number) { p.cols = c; p.rows = r; },
        kill() { p.killed = true; },
      };
      created.push(p);
      return p;
    },
  };
  return { mod, created };
}

test('mode is raw', () => {
  const { mod } = fakePtyModule();
  assert.equal(new PtyBackend(mod as any).mode, 'raw');
});

test('start spawns the pty with interactive args + size + cwd', () => {
  const { mod, created } = fakePtyModule();
  const b = new PtyBackend(mod as any);
  b.start({ shell: 'powershell', cwd: 'C:\\proj' });
  assert.equal(created.length, 1);
  assert.equal(created[0].file, 'powershell.exe');
  assert.deepEqual(created[0].args, ['-NoLogo']);
  assert.equal(created[0].opts.cwd, 'C:\\proj');
  assert.ok(created[0].opts.cols > 0 && created[0].opts.rows > 0);
});

test('write forwards keystrokes to the pty', () => {
  const { mod, created } = fakePtyModule();
  const b = new PtyBackend(mod as any);
  b.start({ shell: 'powershell', cwd: '.' });
  b.write('ls\r');
  assert.deepEqual(created[0].writes, ['ls\r']);
});

test('onData forwards pty output', () => {
  const { mod, created } = fakePtyModule();
  const b = new PtyBackend(mod as any);
  const out: string[] = [];
  b.onData((c) => out.push(c));
  b.start({ shell: 'powershell', cwd: '.' });
  created[0]._data('hello');
  assert.deepEqual(out, ['hello']);
});

test('signal(stop) sends Ctrl+C (0x03) to the pty', () => {
  const { mod, created } = fakePtyModule();
  const b = new PtyBackend(mod as any);
  b.start({ shell: 'powershell', cwd: '.' });
  b.signal('stop');
  assert.deepEqual(created[0].writes, ['\x03']);
});

test('resize forwards to the pty and is remembered for the next start', () => {
  const { mod, created } = fakePtyModule();
  const b = new PtyBackend(mod as any);
  b.start({ shell: 'powershell', cwd: '.' });
  b.resize(120, 40);
  assert.equal(created[0].cols, 120);
  assert.equal(created[0].rows, 40);
});

test('onExit fires with the exit code', () => {
  const { mod, created } = fakePtyModule();
  const b = new PtyBackend(mod as any);
  const exits: any[] = [];
  b.onExit((c) => exits.push(c));
  b.start({ shell: 'powershell', cwd: '.' });
  created[0]._exit({ exitCode: 0, signal: 0 });
  assert.deepEqual(exits, [0]);
});
