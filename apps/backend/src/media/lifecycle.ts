import { prisma } from "../db/prisma.js";
import { deleteStoredMedia, isManagedStorageKey, listStaleManagedMediaKeys } from "./storage.js";

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
  let cursorId: string | undefined;
  let failed = 0;

  while (true) {
    const pending = await prisma.mediaAsset.findMany({
      where: { processingState: "PENDING", createdAt: { lt: cutoff } },
      orderBy: { id: "asc" },
      take: RECONCILIATION_BATCH_SIZE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: { id: true, storageKey: true },
    });
    if (pending.length === 0) break;

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

    cursorId = pending[pending.length - 1].id;
    if (pending.length < RECONCILIATION_BATCH_SIZE) break;
  }

  return failed;
}


/**
 * Remove old managed files that no longer have a usable database reference.
 * READY and PENDING records are preserved; FAILED records are safe to clean.
 */
export async function reconcileOrphanedManagedMediaFiles(olderThanMs = DEFAULT_PENDING_AGE_MS, now = Date.now()) {
  const candidates = await listStaleManagedMediaKeys(olderThanMs, now);
  let removed = 0;

  for (let offset = 0; offset < candidates.length; offset += RECONCILIATION_BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + RECONCILIATION_BATCH_SIZE);
    const assets = await prisma.mediaAsset.findMany({
      where: { storageKey: { in: batch } },
      select: { storageKey: true, processingState: true },
    });
    const usableReferences = new Set(
      assets.filter((asset) => asset.processingState !== "FAILED").map((asset) => asset.storageKey),
    );

    for (const storageKey of batch) {
      if (usableReferences.has(storageKey)) continue;
      try {
        await deleteStoredMedia(storageKey);
        removed += 1;
      } catch {
        // A later startup can retry; do not block API availability.
      }
    }
  }

  return removed;
}
