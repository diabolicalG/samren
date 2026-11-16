import { app } from "./app.js";
import { env } from "./config/env.js";
import { cleanupStaleMediaTempFiles } from "./media/storage.js";

async function start() {
  try {
    const removed = await cleanupStaleMediaTempFiles();
    if (removed > 0) process.stdout.write(`Removed ${removed} abandoned media upload temp file(s)\n`);
  } catch {
    // Cleanup is best-effort; a storage cleanup failure must not prevent API startup.
    process.stderr.write("Media temp-file cleanup did not complete; continuing API startup\n");
  }

  app.listen(env.PORT, env.HOST, () => {
    process.stdout.write(`Samren API listening on http://${env.HOST}:${env.PORT}\n`);
  });
}

void start();
