import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, mkdtempSync } from 'node:fs';
import { HistoryStore } from '../src/panel/history-store';

function tmpFile() {
  const dir = mkdtempSync(join(tmpdir(), 'term-hist-'));
  return { file: join(dir, 'sub', 'history.json'), dir };
}

test('load returns [] when the file does not exist', () => {
  const { file, dir } = tmpFile();
  try { assert.deepEqual(new HistoryStore(file).load(), []); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('save then load round-trips and creates missing dirs', () => {
  const { file, dir } = tmpFile();
  try {
    const s = new HistoryStore(file);
    s.save(['a', 'b', 'c']);
    assert.deepEqual(new HistoryStore(file).load(), ['a', 'b', 'c']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('save trims to max entries (keeps newest)', () => {
  const { file, dir } = tmpFile();
  try {
    const s = new HistoryStore(file, 2);
    s.save(['a', 'b', 'c']);
    assert.deepEqual(new HistoryStore(file, 2).load(), ['b', 'c']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
