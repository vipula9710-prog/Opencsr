export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("./server/env");
  const { logger } = await import("./server/logger");
  const env = getEnv(); // fail fast on invalid configuration
  logger.info("OpenCSR starting", { nodeEnv: env.NODE_ENV, storage: env.STORAGE_DRIVER, email: Boolean(env.SMTP_HOST) });

  let timer: NodeJS.Timeout | null = null;
  if (env.ENABLE_INTERNAL_SCHEDULER && env.NODE_ENV !== "test") {
    const { runJobs } = await import("./server/jobs");
    const tick = () => runJobs().catch((err) => logger.error("scheduler tick failed", { err }));
    timer = setInterval(tick, 60_000);
    timer.unref();
    setTimeout(tick, 5_000).unref();
    logger.info("internal scheduler enabled (60s interval)");
  }

  const shutdown = async (signal: string) => {
    logger.info("shutting down", { signal });
    if (timer) clearInterval(timer);
    const { prisma } = await import("./server/db");
    await prisma.$disconnect().catch(() => {});
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}
