import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { SpawnBackend } from '../src/backend/spawn-backend';
import { sentinelToken } from '../src/shared/sentinel';

function fakeChild() {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.writes = [];
  child.stdin = { write: (s: string) => { child.writes.push(s); return true; } };
  child.killed = false;
  child.kill = () => { child.killed = true; child.emit('exit', null); };
  return child;
}

function makeSpawn() {
  const created: any[] = [];
  const spawnFn = (_file: string, _args: string[], _opts: any) => {
    const c = fakeChild();
    created.push(c);
    return c;
  };
  return { spawnFn, created };
}

test('runLine writes the command + sentinel to stdin', () => {
  const { spawnFn, created } = makeSpawn();
  const b = new SpawnBackend(spawnFn as any);
  b.start({ shell: 'powershell', cwd: 'C:\\proj' });
  b.runLine('git status');
  assert.equal(created.length, 1);
  assert.ok(created[0].writes[0].startsWith('git status'));
  assert.ok(created[0].writes[0].includes(sentinelToken()));
});

test('stdout chunks are forwarded via onData (sentinel stripped)', () => {
  const { spawnFn, created } = makeSpawn();
  const b = new SpawnBackend(spawnFn as any);
  const out: string[] = [];
  b.onData((c) => out.push(c));
  b.start({ shell: 'powershell', cwd: 'C:\\proj' });
  created[0].stdout.emit('data', Buffer.from('hello\n'));
  // flush held-back tail with a newline chunk
  created[0].stdout.emit('data', Buffer.from('\n'));
  assert.ok(out.join('').includes('hello'));
});

test('sentinel in stream fires onIdle with code + cwd', () => {
  const { spawnFn, created } = makeSpawn();
  const b = new SpawnBackend(spawnFn as any);
  const idle: any[] = [];
  b.onIdle((code, cwd) => idle.push({ code, cwd }));
  b.start({ shell: 'powershell', cwd: 'C:\\proj' });
  const T = sentinelToken();
  created[0].stdout.emit('data', Buffer.from(`done\n${T}0|C:\\proj\n`));
  assert.deepEqual(idle, [{ code: 0, cwd: 'C:\\proj' }]);
});

test('signal(stop) kills the child and starts a fresh one', () => {
  const { spawnFn, created } = makeSpawn();
  const b = new SpawnBackend(spawnFn as any);
  b.start({ shell: 'powershell', cwd: 'C:\\proj' });
  b.signal('stop');
  assert.equal(created.length, 2);
  assert.equal(created[0].killed, true);
});

test('onExit fires when the child exits', () => {
  const { spawnFn, created } = makeSpawn();
  const b = new SpawnBackend(spawnFn as any);
  const exits: any[] = [];
  b.onExit((code) => exits.push(code));
  b.start({ shell: 'powershell', cwd: 'C:\\proj' });
  created[0].stdout.emit('data', Buffer.from('x'));
  created[0].emit('exit', 0);
  assert.deepEqual(exits, [0]);
});
