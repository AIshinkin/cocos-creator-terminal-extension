import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHELLS, buildCommand } from '../src/backend/shells';
import { sentinelToken } from '../src/shared/sentinel';

test('powershell preset launches a stdin-reading shell', () => {
  const s = SHELLS.powershell;
  assert.equal(s.file, 'powershell.exe');
  assert.deepEqual(s.args, ['-NoLogo', '-NoProfile', '-Command', '-']);
});

test('buildCommand appends sentinel + eol containing the token', () => {
  const s = SHELLS.powershell;
  const cmd = buildCommand(s, 'git status');
  assert.ok(cmd.startsWith('git status'));
  assert.ok(cmd.includes(sentinelToken()));
  assert.ok(cmd.endsWith(s.eol));
});

test('cmd and bash presets exist with their own suffixes', () => {
  assert.equal(SHELLS.cmd.file, 'cmd.exe');
  assert.equal(SHELLS.bash.file, 'bash.exe');
  assert.ok(buildCommand(SHELLS.cmd, 'dir').includes(sentinelToken()));
  assert.ok(buildCommand(SHELLS.bash, 'ls').includes(sentinelToken()));
});
