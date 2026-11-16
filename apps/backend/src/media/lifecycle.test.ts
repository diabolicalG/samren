import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/prisma.js", () => ({
  prisma: { mediaAsset: { findMany: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("./storage.js", () => ({
  isManagedStorageKey: (storageKey: string) => /^[a-f0-9]{2}\/[a-f0-9]{32}$/.test(storageKey),
  deleteStoredMedia: vi.fn().mockResolvedValue(undefined),
  listStaleManagedMediaKeys: vi.fn().mockResolvedValue([]),
}));

import { prisma } from "../db/prisma.js";
import { deleteStoredMedia, listStaleManagedMediaKeys } from "./storage.js";
import { reconcileOrphanedManagedMediaFiles, reconcileStalePendingMediaAssets } from "./lifecycle.js";

describe("pending media reconciliation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails stale managed assets and removes their local files but skips legacy keys", async () => {
    vi.mocked(prisma.mediaAsset.findMany).mockResolvedValue([
      { id: "managed-asset", storageKey: "ab/0123456789abcdef0123456789abcdef" },
      { id: "legacy-asset", storageKey: "legacy/catalogue/poster.webp" },
    ] as never);
    vi.mocked(prisma.mediaAsset.updateMany).mockResolvedValue({ count: 1 } as never);

    const failed = await reconcileStalePendingMediaAssets(60_000, 1_800_000);

    expect(failed).toBe(1);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { processingState: "PENDING", createdAt: { lt: new Date(1_740_000) } },
      take: 500,
    }));
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: "managed-asset", processingState: "PENDING" },
      data: { processingState: "FAILED" },
    });
    expect(deleteStoredMedia).toHaveBeenCalledTimes(1);
    expect(deleteStoredMedia).toHaveBeenCalledWith("ab/0123456789abcdef0123456789abcdef");
  });

  it("continues past a full batch of legacy metadata assets", async () => {
    const legacyBatch = Array.from({ length: 500 }, (_, index) => ({
      id: `legacy-${String(index).padStart(3, "0")}`,
      storageKey: `legacy/catalogue/${index}.webp`,
    }));
    vi.mocked(prisma.mediaAsset.findMany)
      .mockResolvedValueOnce(legacyBatch as never)
      .mockResolvedValueOnce([{ id: "managed-after-legacy", storageKey: "ab/0123456789abcdef0123456789abcdef" }] as never);
    vi.mocked(prisma.mediaAsset.updateMany).mockResolvedValue({ count: 1 } as never);

    expect(await reconcileStalePendingMediaAssets(60_000, 1_800_000)).toBe(1);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.mediaAsset.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      cursor: { id: "legacy-499" },
      skip: 1,
      take: 500,
    }));
    expect(deleteStoredMedia).toHaveBeenCalledWith("ab/0123456789abcdef0123456789abcdef");
  });

  it("does not delete a file if another worker already changed the state", async () => {
    vi.mocked(prisma.mediaAsset.findMany).mockResolvedValue([
      { id: "raced-asset", storageKey: "ab/0123456789abcdef0123456789abcdef" },
    ] as never);
    vi.mocked(prisma.mediaAsset.updateMany).mockResolvedValue({ count: 0 } as never);

    expect(await reconcileStalePendingMediaAssets(60_000, 1_800_000)).toBe(0);
    expect(deleteStoredMedia).not.toHaveBeenCalled();
  });

  it("removes only stale files without usable database references", async () => {
    const missing = "ab/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const failed = "bc/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const ready = "cd/cccccccccccccccccccccccccccccccc";
    const pending = "de/dddddddddddddddddddddddddddddddd";
    vi.mocked(listStaleManagedMediaKeys).mockResolvedValue([missing, failed, ready, pending]);
    vi.mocked(prisma.mediaAsset.findMany).mockResolvedValue([
      { storageKey: failed, processingState: "FAILED" },
      { storageKey: ready, processingState: "READY" },
      { storageKey: pending, processingState: "PENDING" },
    ] as never);

    const removed = await reconcileOrphanedManagedMediaFiles(60_000, 1_800_000);

    expect(removed).toBe(2);
    expect(deleteStoredMedia).toHaveBeenCalledTimes(2);
    expect(deleteStoredMedia).toHaveBeenCalledWith(missing);
    expect(deleteStoredMedia).toHaveBeenCalledWith(failed);
    expect(deleteStoredMedia).not.toHaveBeenCalledWith(ready);
    expect(deleteStoredMedia).not.toHaveBeenCalledWith(pending);
  });

  it("rejects unsafe reconciliation thresholds", async () => {
    await expect(reconcileStalePendingMediaAssets(1)).rejects.toThrow("Invalid pending media reconciliation parameters");
    expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
  });
});
