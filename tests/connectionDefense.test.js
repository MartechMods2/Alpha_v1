import test from "node:test";
import assert from "node:assert/strict";
import { createConnectionManager } from "../utils/connectionManager.js";
const tick = () => new Promise((resolve) => setImmediate(resolve));
function timers() {
  const rows = [];
  return {
    rows,
    delay(fn, ms) {
      const row = { fn, ms, cancelled: false, unref() {} };
      rows.push(row);
      return row;
    },
    cancel(row) {
      row.cancelled = true;
    },
  };
}
test("socket initialization is single-flight and stale close callbacks cannot restart a newer session", async () => {
  const clock = timers();
  let created = 0,
    release;
  const ready = new Promise((r) => (release = r));
  const callbacks = [];
  const manager = createConnectionManager({
    create: async () => {
      created++;
      await ready;
      return { end() {} };
    },
    attach: async (_sock, start) => callbacks.push(start),
    delay: clock.delay,
    cancel: clock.cancel,
    random: () => 0.5,
  });
  const a = manager.start(),
    b = manager.start();
  assert.equal(a, b);
  release();
  await a;
  assert.equal(created, 1);
  await manager.start("manual-reconnect");
  assert.equal(created, 2);
  await callbacks[0]("reconnect");
  assert.equal(manager.stats().scheduled, false);
  manager.stop();
});
test("reconnect scheduling is deduplicated, backoff is capped, and failures exhaust a bounded budget", async () => {
  const clock = timers();
  const manager = createConnectionManager({
    create: async () => {
      throw Error("mock network");
    },
    attach: async () => {},
    delay: clock.delay,
    cancel: clock.cancel,
    random: () => 0.5,
    maxAttempts: 3,
  });
  await manager.start();
  assert.equal(clock.rows.length, 1);
  await manager.start("reconnect");
  assert.equal(clock.rows.length, 1);
  await clock.rows[0].fn();
  await tick();
  assert.equal(clock.rows.length, 2);
  assert.ok(clock.rows[1].ms > clock.rows[0].ms);
  await clock.rows[1].fn();
  await tick();
  assert.equal(manager.stats().attempts, 3);
  assert.equal(manager.stats().scheduled, false);
  assert.equal(manager.stats().stopped, true);
  manager.stop();
});
test("logout stops pending retries; manual reconnect can recover without deleting session data", async () => {
  const clock = timers();
  let created = 0;
  const manager = createConnectionManager({
    create: async () => {
      created++;
      return { end() {} };
    },
    attach: async () => {},
    delay: clock.delay,
    cancel: clock.cancel,
  });
  await manager.start();
  await manager.start("reconnect");
  const timer = clock.rows.at(-1);
  await manager.start("session-stop");
  assert.equal(timer.cancelled, true);
  assert.equal(await manager.start("retry"), null);
  await manager.start("manual-reconnect");
  assert.equal(created, 2);
  manager.stop();
});

test("controlled shutdown flushes state, runs once and exits nonzero on unsafe failures", async () => {
  const { createControlledShutdown } = await import(
    "../utils/controlledShutdown.js"
  );
  const exits = [];
  let began = 0,
    flushed = 0;
  const shutdown = createControlledShutdown({
    begin: () => began++,
    flush: async () => flushed++,
    closeSockets: () => {},
    closeServer: async () => {},
    exit: (code) => exits.push(code),
  });
  const one = shutdown(1),
    two = shutdown(1);
  assert.equal(one, two);
  assert.equal(await one, 1);
  assert.equal(began, 1);
  assert.equal(flushed, 1);
  assert.deepEqual(exits, [1]);
  const bad = createControlledShutdown({
    begin: () => {},
    flush: async () => {
      throw Error("DB unavailable");
    },
    closeSockets: () => {},
    closeServer: async () => {},
    exit: (code) => exits.push(code),
  });
  assert.equal(await bad(), 1);
  const blocked = createControlledShutdown({
    begin: () => {},
    flush: () => new Promise(() => {}),
    closeSockets: () => {},
    closeServer: async () => {},
    timeoutMs: 15,
    exit: (code) => exits.push(code),
  });
  assert.equal(await blocked(), 1);
});
