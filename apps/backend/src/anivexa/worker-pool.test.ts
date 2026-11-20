import { describe, expect, it } from "vitest";
import { BoundedWorkerPool, ProviderCircuitBreaker, WorkerQueueFullError } from "./worker-pool.js";

describe("Anivexa bounded provider workers", () => {
  it("never exceeds the configured concurrency", async () => {
    const pool = new BoundedWorkerPool(2, 8);
    let active = 0;
    let peak = 0;
    await Promise.all(Array.from({ length: 6 }, () => pool.run(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    })));
    expect(peak).toBe(2);
    expect(pool.stats.active).toBe(0);
    expect(pool.stats.queued).toBe(0);
  });

  it("rejects new work when its bounded queue is full", async () => {
    const pool = new BoundedWorkerPool(1, 1);
    let release: (() => void) | undefined;
    const first = pool.run(() => new Promise<void>((resolve) => { release = resolve; }));
    const second = pool.run(() => undefined);
    await expect(pool.run(() => undefined)).rejects.toBeInstanceOf(WorkerQueueFullError);
    release?.();
    await Promise.all([first, second]);
  });

  it("opens a provider circuit after repeated failures and resets it on success", () => {
    const circuit = new ProviderCircuitBreaker(2, 1000);
    circuit.failure("animegg", 10);
    expect(circuit.isOpen("animegg", 10)).toBe(false);
    circuit.failure("animegg", 20);
    expect(circuit.isOpen("animegg", 21)).toBe(true);
    expect(circuit.status("animegg", 21)).toMatchObject({ failures: 2, open: true, retryAt: 1020 });
    expect(circuit.isOpen("animegg", 1020)).toBe(false);
    circuit.success("animegg");
    expect(circuit.status("animegg", 1021)).toMatchObject({ failures: 0, open: false, retryAt: null });
  });
});
