import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sentinelToken, scanSentinel } from '../src/shared/sentinel';

test('passes through plain output with no sentinel, holding back a short tail', () => {
  const r = scanSentinel('hello world\n');
  assert.equal(r.result, null);
  assert.ok('hello world\n'.startsWith(r.display));
  assert.equal(r.display + r.remainder, 'hello world\n');
});

test('parses a sentinel with exit code and cwd', () => {
  const T = sentinelToken();
  const r = scanSentinel(`output line\n${T}0|C:\\proj\n`);
  assert.equal(r.display, 'output line\n');
  assert.deepEqual(r.result, { code: 0, cwd: 'C:\\proj' });
  assert.equal(r.remainder, '');
});

test('parses non-zero exit code', () => {
  const T = sentinelToken();
  const r = scanSentinel(`${T}1|/home/u`);
  assert.deepEqual(r.result, { code: 1, cwd: '/home/u' });
});

test('keeps remainder after the sentinel for the next scan', () => {
  const T = sentinelToken();
  const r = scanSentinel(`done\n${T}0|C:\\a\nnext`);
  assert.equal(r.display, 'done\n');
  assert.equal(r.remainder, 'next');
});

test('holds back a partial token so a split sentinel is not shown', () => {
  const T = sentinelToken();
  const half = T.slice(0, 3);
  const r = scanSentinel(`abc${half}`);
  assert.equal(r.display, 'abc');
  assert.equal(r.remainder, half);
});
