import { AsyncSemaphore, type Release } from '@lp-labs/async-semaphore';
const semaphore = new AsyncSemaphore({ capacity: 1, maxQueue: 2 });
const permit: Promise<Release> = semaphore.acquire();
void permit;
// @ts-expect-error bounded queue required
new AsyncSemaphore({ capacity: 2 });
// @ts-expect-error callback required
semaphore.withPermit(1);
