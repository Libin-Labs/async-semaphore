import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as library from '../dist/esm/index.js';
const { QueueFullError, AsyncSemaphore } = library;

test('FIFO tickets and idempotent releases', async () => {
  const s = new AsyncSemaphore({ capacity: 1, maxQueue: 3 });
  const a = await s.acquire();
  const order = [];
  const b = s.acquire().then((r) => {
    order.push('b');
    return r;
  });
  const c = s.acquire().then((r) => {
    order.push('c');
    return r;
  });
  assert.equal(s.pending, 2);
  a();
  a();
  const rb = await b;
  assert.deepEqual(order, ['b']);
  rb();
  const rc = await c;
  assert.deepEqual(order, ['b', 'c']);
  rc();
  assert.equal(s.active, 0);
});
test('queue bound is enforced', async () => {
  const s = new AsyncSemaphore({ capacity: 1, maxQueue: 0 });
  const r = await s.acquire();
  await assert.rejects(s.acquire(), QueueFullError);
  r();
});
test('aborted queued ticket is removed without stealing permit', async () => {
  const s = new AsyncSemaphore({ capacity: 1, maxQueue: 2 });
  const r = await s.acquire();
  const c = new AbortController();
  const p = s.acquire(c.signal);
  c.abort('gone');
  await assert.rejects(p, (x) => x === 'gone');
  assert.equal(s.pending, 0);
  r();
  assert.equal(s.active, 0);
});
test('preabort does not acquire', async () => {
  const s = new AsyncSemaphore({ capacity: 1, maxQueue: 1 });
  const c = new AbortController();
  c.abort('no');
  await assert.rejects(s.acquire(c.signal), (x) => x === 'no');
  assert.equal(s.active, 0);
});
test('scope preserves thrown undefined and releases', async () => {
  const s = new AsyncSemaphore({ capacity: 1, maxQueue: 1 });
  let caught = false;
  try {
    await s.withPermit(() => {
      throw undefined;
    });
  } catch (e) {
    caught = true;
    assert.equal(e, undefined);
  }
  assert.equal(caught, true);
  assert.equal(s.active, 0);
  assert.equal(await s.withPermit(() => 7), 7);
});
test('grant then abort race releases scoped permit', async () => {
  const s = new AsyncSemaphore({ capacity: 1, maxQueue: 1 });
  const r = await s.acquire();
  const c = new AbortController();
  let called = false;
  const p = s.withPermit(() => {
    called = true;
  }, c.signal);
  r();
  c.abort('race');
  await assert.rejects(p, (x) => x === 'race');
  assert.equal(called, false);
  assert.equal(s.active, 0);
  assert.throws(() => new AsyncSemaphore({ capacity: 0, maxQueue: 1 }), RangeError);
});
