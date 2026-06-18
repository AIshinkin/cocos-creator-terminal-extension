import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../src/session-manager';

function fakeBackend() {
  const b: any = {
    started: null, lines: [], signals: [], written: [], resized: [], disposed: false,
    _data: (_: string) => {}, _idle: (_c: any, _w: any) => {}, _exit: (_: any) => {},
    mode: 'line',
    start(o: any) { b.started = o; },
    runLine(l: string) { b.lines.push(l); },
    write(d: string) { b.written.push(d); },
    resize(c: number, r: number) { b.resized.push([c, r]); },
    signal(s: string) { b.signals.push(s); },
    dispose() { b.disposed = true; },
    onData(cb: any) { b._data = cb; },
    onIdle(cb: any) { b._idle = cb; },
    onExit(cb: any) { b._exit = cb; },
  };
  return b;
}

function setup() {
  const made: any[] = [];
  const factory = (kind: any) => { const b = fakeBackend(); b.kind = kind; b.mode = kind === 'pty' ? 'raw' : 'line'; made.push(b); return b; };
  const events: any[] = [];
  const mgr = new SessionManager({
    onData: (id, c) => events.push(['data', id, c]),
    onIdle: (id, code, cwd) => events.push(['idle', id, code, cwd]),
    onExit: (id, code) => events.push(['exit', id, code]),
  }, factory);
  return { mgr, made, events };
}

test('open prefers the pty backend and returns its mode', () => {
  const { mgr, made, events } = setup();
  const mode = mgr.open('s1', 'powershell', 'C:\\proj');
  assert.equal(made.length, 1);
  assert.equal(made[0].kind, 'pty');
  assert.equal(mode, 'raw');
  assert.deepEqual(made[0].started, { shell: 'powershell', cwd: 'C:\\proj' });
  made[0]._data('hi');
  assert.deepEqual(events, [['data', 's1', 'hi']]);
});

test('open falls back to spawn (line mode) when pty creation throws', () => {
  const made: any[] = [];
  const factory = (kind: any) => {
    if (kind === 'pty') throw new Error('no native binary');
    const b = fakeBackend(); b.kind = kind; b.mode = 'line'; made.push(b); return b;
  };
  const mgr = new SessionManager({ onData() {}, onIdle() {}, onExit() {} }, factory);
  const mode = mgr.open('s1', 'powershell', '.');
  assert.equal(mode, 'line');
  assert.equal(made.length, 1);
  assert.equal(made[0].kind, 'spawn');
});

test('write and resize forward to the session backend', () => {
  const { mgr, made } = setup();
  mgr.open('s1', 'powershell', '.');
  mgr.write('s1', 'abc');
  mgr.resize('s1', 100, 30);
  assert.deepEqual(made[0].written, ['abc']);
  assert.deepEqual(made[0].resized, [[100, 30]]);
});

test('run forwards the line to the right session backend', () => {
  const { mgr, made } = setup();
  mgr.open('s1', 'powershell', 'C:\\proj');
  mgr.run('s1', 'ls');
  assert.deepEqual(made[0].lines, ['ls']);
});

test('opening the same id twice disposes the previous backend', () => {
  const { mgr, made } = setup();
  mgr.open('s1', 'powershell', 'C:\\a');
  mgr.open('s1', 'cmd', 'C:\\a');
  assert.equal(made[0].disposed, true);
  assert.equal(made[1].started.shell, 'cmd');
});

test('close disposes and run after close is a no-op', () => {
  const { mgr, made } = setup();
  mgr.open('s1', 'powershell', 'C:\\a');
  mgr.close('s1');
  assert.equal(made[0].disposed, true);
  mgr.run('s1', 'ls'); // must not throw
});
