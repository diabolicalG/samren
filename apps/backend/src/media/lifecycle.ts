import { prisma } from "../db/prisma.js";
import { deleteStoredMedia, isManagedStorageKey } from "./storage.js";

const DEFAULT_PENDING_AGE_MS = 24 * 60 * 60 * 1000;
const RECONCILIATION_BATCH_SIZE = 500;

/**
 * Fail abandoned managed uploads. Metadata-only legacy assets are intentionally
 * excluded because their storage keys are not generated local-media keys.
 */
export async function reconcileStalePendingMediaAssets(olderThanMs = DEFAULT_PENDING_AGE_MS, now = Date.now()) {
  if (!Number.isSafeInteger(olderThanMs) || olderThanMs < 60_000 || !Number.isFinite(now)) {
    throw new Error("Invalid pending media reconciliation parameters");
  }

  const cutoff = new Date(now - olderThanMs);
  const pending = await prisma.mediaAsset.findMany({
    where: { processingState: "PENDING", createdAt: { lt: cutoff } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: RECONCILIATION_BATCH_SIZE,
    select: { id: true, storageKey: true },
  });

  let failed = 0;
  for (const asset of pending) {
    if (!isManagedStorageKey(asset.storageKey)) continue;

    const changed = await prisma.mediaAsset.updateMany({
      where: { id: asset.id, processingState: "PENDING" },
      data: { processingState: "FAILED" },
    });
    if (changed.count !== 1) continue;

    await deleteStoredMedia(asset.storageKey).catch(() => undefined);
    failed += 1;
  }

  return failed;
}
