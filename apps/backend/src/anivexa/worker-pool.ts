export class WorkerQueueFullError extends Error {
  constructor() {
    super("Provider worker queue is full");
    this.name = "WorkerQueueFullError";
  }
}

type QueuedTask<T> = {
  task: () => Promise<T> | T;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

export class BoundedWorkerPool {
  private readonly queue: Array<QueuedTask<unknown>> = [];
  private active = 0;

  constructor(
    readonly concurrency = 4,
    readonly maxQueue = 64,
  ) {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 32) {
      throw new Error("Worker concurrency must be between 1 and 32");
    }
    if (!Number.isSafeInteger(maxQueue) || maxQueue < 1 || maxQueue > 10_000) {
      throw new Error("Worker queue capacity must be between 1 and 10000");
    }
  }

  get stats() {
    return { concurrency: this.concurrency, active: this.active, queued: this.queue.length, maxQueue: this.maxQueue };
  }

  run<T>(task: () => Promise<T> | T): Promise<T> {
    if (this.queue.length >= this.maxQueue) return Promise.reject(new WorkerQueueFullError());
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve: resolve as (value: unknown) => void, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) return;
      this.active += 1;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}

type CircuitState = { failures: number; openUntil: number };

export class ProviderCircuitBreaker {
  private readonly states = new Map<string, CircuitState>();

  constructor(
    readonly failureThreshold = 3,
    readonly cooldownMs = 30_000,
  ) {
    if (!Number.isSafeInteger(failureThreshold) || failureThreshold < 1) throw new Error("Circuit failure threshold must be positive");
    if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 1) throw new Error("Circuit cooldown must be positive");
  }

  isOpen(provider: string, now = Date.now()): boolean {
    const state = this.states.get(provider);
    return Boolean(state && state.openUntil > now);
  }

  success(provider: string): void {
    this.states.delete(provider);
  }

  failure(provider: string, now = Date.now()): void {
    const state = this.states.get(provider) ?? { failures: 0, openUntil: 0 };
    state.failures += 1;
    if (state.failures >= this.failureThreshold) state.openUntil = now + this.cooldownMs;
    this.states.set(provider, state);
  }

  status(provider: string, now = Date.now()): { failures: number; open: boolean; retryAt: number | null } {
    const state = this.states.get(provider);
    return {
      failures: state?.failures ?? 0,
      open: Boolean(state && state.openUntil > now),
      retryAt: state && state.openUntil > now ? state.openUntil : null,
    };
  }
}
