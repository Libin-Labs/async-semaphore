import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { AsyncSemaphore } from '../dist/esm/index.js';

test('cancellation of a middle ticket preserves FIFO successors', async () => {
  const semaphore = new AsyncSemaphore({ capacity: 1, maxQueue: 3 });
  const first = await semaphore.acquire();
  const a = semaphore.acquire();
  const controller = new AbortController();
  const b = semaphore.acquire(controller.signal);
  const c = semaphore.acquire();
  controller.abort('removed');
  await assert.rejects(b, (error) => error === 'removed');
  first();
  const ra = await a;
  assert.equal(semaphore.pending, 1);
  ra();
  const rc = await c;
  rc();
  assert.equal(semaphore.active, 0);
  assert.equal(semaphore.pending, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('granted permit remains owned after abort and listener is detached', async () => {
  const semaphore = new AsyncSemaphore({ capacity: 1, maxQueue: 1 });
  const first = await semaphore.acquire();
  const controller = new AbortController();
  const pending = semaphore.acquire(controller.signal);
  first();
  controller.abort('late');
  const release = await pending;
  assert.equal(semaphore.active, 1);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  release();
  release();
  assert.equal(semaphore.active, 0);
});

test('concurrency never exceeds capacity across interleaved scopes', async () => {
  const semaphore = new AsyncSemaphore({ capacity: 2, maxQueue: 2 });
  const starts = [];
  const gates = [];
  const tasks = [0, 1, 2, 3].map((id) =>
    semaphore.withPermit(async () => {
      starts.push(id);
      await new Promise((resolve) => {
        gates[id] = resolve;
      });
    }),
  );
  await Promise.resolve();
  assert.deepEqual(starts, [0, 1]);
  assert.equal(semaphore.active, 2);
  gates[1]();
  await tasks[1];
  await Promise.resolve();
  assert.deepEqual(starts, [0, 1, 2]);
  gates[0]();
  await tasks[0];
  await Promise.resolve();
  assert.deepEqual(starts, [0, 1, 2, 3]);
  gates[2]();
  gates[3]();
  await Promise.all(tasks);
  assert.equal(semaphore.active, 0);
});
