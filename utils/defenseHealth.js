import { monitorEventLoopDelay } from "node:perf_hooks";
import { ingestionDefense } from "./ingestionDefense.js";
let draining = false,
  lastWarning = 0;
const lag = monitorEventLoopDelay({ resolution: 20 });
lag.enable();
export function defenseHealth() {
  const memory = process.memoryUsage(),
    ingestion = ingestionDefense.stats();
  const lagMs = Number.isFinite(lag.percentile(99))
    ? lag.percentile(99) / 1e6
    : 0;
  const heapLimit = ingestionDefense.config.heapWarnMb * 1048576;
  return {
    status:
      draining || ingestion.stopped
        ? "draining"
        : ingestion.queued >= ingestionDefense.config.queue * 0.9 ||
            memory.heapUsed > heapLimit ||
            memory.rss > ingestionDefense.config.rssWarnMb * 1048576 ||
            lagMs > 250
          ? "degraded"
          : "ok",
    uptime: Math.floor(process.uptime()),
    heapBytes: memory.heapUsed,
    rssBytes: memory.rss,
    eventLoopP99Ms: Math.round(lagMs),
    ingestion,
  };
}
export function startDefenseMonitoring() {
  const timer = setInterval(() => {
    const health = defenseHealth();
    if (health.status !== "ok" && Date.now() - lastWarning > 300000) {
      lastWarning = Date.now();
      console.warn(
        "[DEFENSE] Resource pressure detected; inspect authenticated health metrics.",
      );
    }
    lag.reset();
  }, 30000);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    lag.disable();
  };
}
export const beginDraining = () => {
  draining = true;
  ingestionDefense.stop();
};
