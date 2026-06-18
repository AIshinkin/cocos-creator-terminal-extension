import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LineEditor } from '../src/panel/line-editor';

function type(ed: LineEditor, s: string) { for (const ch of s) ed.handleKey(ch); }

test('typing accumulates into the line and echoes characters', () => {
  const ed = new LineEditor();
  const r = ed.handleKey('a');
  assert.equal(ed.getLine(), 'a');
  assert.equal(r.write, 'a');
});

test('Enter submits the line and clears the buffer', () => {
  const ed = new LineEditor();
  type(ed, 'ls');
  const r = ed.handleKey('\r');
  assert.equal(r.submit, 'ls');
  assert.equal(ed.getLine(), '');
});

test('Backspace removes the char before the cursor', () => {
  const ed = new LineEditor();
  type(ed, 'abc');
  ed.handleKey('\x7f');
  assert.equal(ed.getLine(), 'ab');
  assert.equal(ed.getCursor(), 2);
});

test('left arrow moves the cursor and insert happens mid-line', () => {
  const ed = new LineEditor();
  type(ed, 'ac');
  ed.handleKey('\x1b[D'); // left, cursor between a|c
  ed.handleKey('b');
  assert.equal(ed.getLine(), 'abc');
  assert.equal(ed.getCursor(), 2);
});

test('history up/down recalls previous submissions', () => {
  const ed = new LineEditor();
  type(ed, 'first'); ed.handleKey('\r');
  type(ed, 'second'); ed.handleKey('\r');
  ed.handleKey('\x1b[A'); // up -> second
  assert.equal(ed.getLine(), 'second');
  ed.handleKey('\x1b[A'); // up -> first
  assert.equal(ed.getLine(), 'first');
  ed.handleKey('\x1b[B'); // down -> second
  assert.equal(ed.getLine(), 'second');
});

test('history seeded from constructor is recalled', () => {
  const ed = new LineEditor(['old']);
  ed.handleKey('\x1b[A');
  assert.equal(ed.getLine(), 'old');
});

test('insertText pastes a block at the cursor, newlines flattened to spaces', () => {
  const ed = new LineEditor();
  type(ed, 'gitstatus');
  for (let i = 0; i < 6; i++) ed.handleKey('\x1b[D'); // cursor after "git"
  ed.insertText(' commit\nfoo');
  assert.equal(ed.getLine(), 'git commit foostatus');
});

test('insertText on empty line inserts plain text', () => {
  const ed = new LineEditor();
  const w = ed.insertText('npm run build');
  assert.equal(ed.getLine(), 'npm run build');
  assert.ok(w.includes('npm run build'));
});

test('duplicate consecutive commands are not duplicated in history', () => {
  const ed = new LineEditor();
  type(ed, 'ls'); ed.handleKey('\r');
  type(ed, 'ls'); ed.handleKey('\r');
  assert.deepEqual(ed.getHistory(), ['ls']);
});
