import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TabModel } from '../src/panel/tab-model';

test('add appends a tab and makes it active', () => {
  const m = new TabModel();
  m.add('a', 'Terminal 1');
  m.add('b', 'Terminal 2');
  assert.deepEqual(m.list().map(t => t.id), ['a', 'b']);
  assert.equal(m.activeId(), 'b');
  assert.equal(m.get('a')!.color, null);
});

test('select changes the active tab, ignores unknown ids', () => {
  const m = new TabModel();
  m.add('a', 'A'); m.add('b', 'B');
  m.select('a');
  assert.equal(m.activeId(), 'a');
  m.select('zzz');
  assert.equal(m.activeId(), 'a');
});

test('rename and setColor mutate the named tab', () => {
  const m = new TabModel();
  m.add('a', 'A');
  m.rename('a', 'Build');
  m.setColor('a', '#e06c75');
  assert.equal(m.get('a')!.title, 'Build');
  assert.equal(m.get('a')!.color, '#e06c75');
  m.setColor('a', null);
  assert.equal(m.get('a')!.color, null);
});

test('closing the active tab selects the right neighbor', () => {
  const m = new TabModel();
  m.add('a', 'A'); m.add('b', 'B'); m.add('c', 'C');
  m.select('b');
  const emptied = m.close('b');
  assert.equal(emptied, false);
  assert.equal(m.activeId(), 'c');
  assert.deepEqual(m.list().map(t => t.id), ['a', 'c']);
});

test('closing the active last tab selects the left neighbor', () => {
  const m = new TabModel();
  m.add('a', 'A'); m.add('b', 'B');
  m.select('b');
  m.close('b');
  assert.equal(m.activeId(), 'a');
});

test('closing a non-active tab keeps the active one', () => {
  const m = new TabModel();
  m.add('a', 'A'); m.add('b', 'B');
  m.select('b');
  m.close('a');
  assert.equal(m.activeId(), 'b');
});

test('closing the only tab empties the model', () => {
  const m = new TabModel();
  m.add('a', 'A');
  const emptied = m.close('a');
  assert.equal(emptied, true);
  assert.equal(m.activeId(), null);
  assert.deepEqual(m.list(), []);
});

test('closing an unknown id is a no-op (reports empty state)', () => {
  const m = new TabModel();
  m.add('a', 'A');
  const emptied = m.close('zzz');
  assert.equal(emptied, false);
  assert.equal(m.activeId(), 'a');
});
