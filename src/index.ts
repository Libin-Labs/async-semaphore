export interface SemaphoreOptions {
  capacity: number;
  maxQueue: number;
}
export type Release = () => void;
export class QueueFullError extends Error {
  constructor() {
    super('Semaphore queue is full');
    this.name = 'QueueFullError';
  }
}
interface Ticket {
  resolve: (release: Release) => void;
  signal: AbortSignal | undefined;
  abort: () => void;
}
export class AsyncSemaphore {
  readonly capacity: number;
  readonly maxQueue: number;
  private used = 0;
  private readonly queue: Ticket[] = [];
  constructor(options: SemaphoreOptions) {
    if (
      !Number.isSafeInteger(options.capacity) ||
      options.capacity < 1 ||
      !Number.isSafeInteger(options.maxQueue) ||
      options.maxQueue < 0
    )
      throw new RangeError('Invalid semaphore limits');
    this.capacity = options.capacity;
    this.maxQueue = options.maxQueue;
  }
  get active(): number {
    return this.used;
  }
  get pending(): number {
    return this.queue.length;
  }
  private permit(): Release {
    this.used++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.used--;
      const ticket = this.queue.shift();
      if (ticket) {
        ticket.signal?.removeEventListener('abort', ticket.abort);
        ticket.resolve(this.permit());
      }
    };
  }
  acquire(signal?: AbortSignal): Promise<Release> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (this.used < this.capacity) return Promise.resolve(this.permit());
    if (this.queue.length >= this.maxQueue) return Promise.reject(new QueueFullError());
    return new Promise((resolve, reject) => {
      const ticket: Ticket = {
        resolve,
        signal,
        abort: () => {
          const index = this.queue.indexOf(ticket);
          if (index < 0) return;
          this.queue.splice(index, 1);
          signal?.removeEventListener('abort', ticket.abort);
          reject(signal?.reason);
        },
      };
      this.queue.push(ticket);
      signal?.addEventListener('abort', ticket.abort, { once: true });
    });
  }
  async withPermit<T>(operation: () => T | Promise<T>, signal?: AbortSignal): Promise<T> {
    const release = await this.acquire(signal);
    try {
      if (signal?.aborted) throw signal.reason;
      return await operation();
    } finally {
      release();
    }
  }
}
