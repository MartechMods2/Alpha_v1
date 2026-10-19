import assert from "node:assert/strict";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { IngestionDefense, defenseConfig } from "../utils/ingestionDefense.js";
const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
const before = process.memoryUsage().heapUsed,
  started = performance.now();
let clock = 0;
const defense = new IngestionDefense({
  clock: () => clock,
  config: { ...defenseConfig({}), stateCap: 500, queue: 32, chatQueue: 8 },
});
const messages = () =>
  Array.from({ length: 100 }, (_, i) =>
    defense.submit(
      {
        key: {
          remoteJid: `test-${i % 10}@g.us`,
          participant: `synthetic-${i % 20}@lid`,
          id: "message-" + clock + "-" + i,
        },
        message: { conversation: "Synthetic multilingual sample: Ẹ káàárọ̀ 👋" },
      },
      async () => new Promise((resolve) => setImmediate(resolve)),
    ),
  );
for (let batch = 0; batch < 20; batch++) {
  await Promise.all(messages());
  clock += 1000;
  await new Promise((resolve) => setImmediate(resolve));
}
await new Promise((resolve) => setTimeout(resolve, 25));
const stats = defense.stats(),
  growth = process.memoryUsage().heapUsed - before;
assert.equal(stats.active, 0);
assert.equal(stats.queued, 0);
assert.ok(stats.identities <= 500);
assert.ok(stats.dedup <= 500);
assert.ok(growth < 32 * 1048576);
assert.ok(performance.now() - started < 10000);
console.log(
  JSON.stringify({
    syntheticMessages: 2000,
    accepted: stats.accepted,
    dropped: stats.dropped,
    heapGrowthBytes: growth,
    eventLoopP99Ms: loop.percentile(99) / 1e6,
    durationMs: Math.round(performance.now() - started),
    stateEntries: stats.identities,
    dedupEntries: stats.dedup,
  }),
);
defense.stop();
loop.disable();
