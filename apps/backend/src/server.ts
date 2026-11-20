import { app } from "./app.js";
import { env } from "./config/env.js";
import { cleanupStaleMediaTempFiles } from "./media/storage.js";
import { reconcileOrphanedManagedMediaFiles, reconcileStalePendingMediaAssets } from "./media/lifecycle.js";

async function start() {
  try {
    const removed = await cleanupStaleMediaTempFiles();
    if (removed > 0) process.stdout.write(`Removed ${removed} abandoned media upload temp file(s)\n`);
  } catch {
    process.stderr.write("Media temp-file cleanup did not complete; continuing API startup\n");
  }

  try {
    const failed = await reconcileStalePendingMediaAssets();
    if (failed > 0) process.stdout.write(`Marked ${failed} abandoned media asset(s) as failed\n`);
  } catch {
    process.stderr.write("Pending media reconciliation did not complete; continuing API startup\n");
  }

  try {
    const removed = await reconcileOrphanedManagedMediaFiles();
    if (removed > 0) process.stdout.write(`Removed ${removed} unreferenced managed media file(s)\n`);
  } catch {
    process.stderr.write("Orphan media reconciliation did not complete; continuing API startup\n");
  }

  const server = app.listen(env.PORT, env.HOST, () => {
    process.stdout.write(`Samren API listening on http://${env.HOST}:${env.PORT}\n`);
  });
  server.requestTimeout = env.MEDIA_UPLOAD_TIMEOUT_MS;
  server.headersTimeout = Math.min(60_000, env.MEDIA_UPLOAD_TIMEOUT_MS);
}

void start();
