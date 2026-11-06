# @lp-labs/async-semaphore

FIFO bounded acquisition tickets and scoped asynchronous permits.

## Install

```sh
npm install @lp-labs/async-semaphore
```

Zero runtime, peer, or sibling dependencies. Node 18+; strict TypeScript declarations and independent ESM/CommonJS builds. Version 0.1.0, MIT.

## Quickstart

```js
import { AsyncSemaphore } from '@lp-labs/async-semaphore';
const semaphore = new AsyncSemaphore({ capacity: 2, maxQueue: 8 });
const value = await semaphore.withPermit(async () => 42);
console.log(value, semaphore.active); // 42 0
```

## API and contracts

Acquire resolves an idempotent Release; the caller owns the permit after grant and must release even if subsequently aborted. Pending tickets are FIFO; aborted tickets are removed and reject with the exact signal reason. QueueFullError is immediate overflow rejection. withPermit releases in finally and checks cancellation after grant before invoking work; in-flight work is cooperative, not forcibly cancelled. Capacity and maxQueue are safe integers (positive and nonnegative respectively). Invalid limits throw RangeError. No scheduling/map API, timeouts, worker pool, or message runtime. Acquisition/release O(queue length) due to array shift, queued cancellation O(queue length); queue memory is bounded by maxQueue.

## Full declarations

The complete public declarations below are generated from the package's strict source. All runtime exports, interfaces, options, return types and readonly state are listed here.

<!-- declarations -->

```ts
export interface SemaphoreOptions {
  capacity: number;
  maxQueue: number;
}
export type Release = () => void;
export declare class QueueFullError extends Error {
  constructor();
}
export declare class AsyncSemaphore {
  readonly capacity: number;
  readonly maxQueue: number;
  private used;
  private readonly queue;
  constructor(options: SemaphoreOptions);
  get active(): number;
  get pending(): number;
  private permit;
  acquire(signal?: AbortSignal): Promise<Release>;
  withPermit<T>(operation: () => T | Promise<T>, signal?: AbortSignal): Promise<T>;
}
```

<!-- end declarations -->

## Development

```sh
npm ci --offline
npm run build
npm run typecheck
npm test
npm run format:check
```

All tests use deterministic clocks, immediate injected sleeps, or explicit promise gates rather than timing guesses. Package exports select ESM for import and CommonJS for require, with separate declaration trees. No runtime configuration files or global hooks.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
