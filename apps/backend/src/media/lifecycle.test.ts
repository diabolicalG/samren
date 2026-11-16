import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/prisma.js", () => ({
  prisma: { mediaAsset: { findMany: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("./storage.js", () => ({
  isManagedStorageKey: (storageKey: string) => /^[a-f0-9]{2}\/[a-f0-9]{32}$/.test(storageKey),
  deleteStoredMedia: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../db/prisma.js";
import { deleteStoredMedia } from "./storage.js";
import { reconcileStalePendingMediaAssets } from "./lifecycle.js";

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

  it("does not delete a file if another worker already changed the state", async () => {
    vi.mocked(prisma.mediaAsset.findMany).mockResolvedValue([
      { id: "raced-asset", storageKey: "ab/0123456789abcdef0123456789abcdef" },
    ] as never);
    vi.mocked(prisma.mediaAsset.updateMany).mockResolvedValue({ count: 0 } as never);

    expect(await reconcileStalePendingMediaAssets(60_000, 1_800_000)).toBe(0);
    expect(deleteStoredMedia).not.toHaveBeenCalled();
  });

  it("rejects unsafe reconciliation thresholds", async () => {
    await expect(reconcileStalePendingMediaAssets(1)).rejects.toThrow("Invalid pending media reconciliation parameters");
    expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
  });
});
