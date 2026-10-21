import test from "node:test";
import assert from "node:assert/strict";
import { createAuraMongoStore } from "../utils/aura/mongoStore.js";
test("member history queries retain filtering, bounded result size and a server execution deadline", async () => {
  const calls = [];
  const cursor = {
    sort: (value) => { calls.push(["sort", value]); return cursor; },
    limit: (value) => { calls.push(["limit", value]); return cursor; },
    maxTimeMS: (value) => { calls.push(["deadline", value]); return cursor; },
    toArray: async () => [],
  };
  const store = createAuraMongoStore({ db: () => ({ collection: () => ({
    find: (query) => { calls.push(["find", query]); return cursor; },
  }) }) });
  const query = { actor: "member", kind: { $ne: "group-text" } };
  await store.find("AuraLedger", query, { at: -1 }, 1000);
  assert.deepEqual(calls, [["find", query], ["sort", { at: -1 }], ["limit", 100], ["deadline", 5000]]);
});
test("Mongo adapter initializes indexes and attaches the same session to all transactional operations", async () => {
  const calls = [];
  let ended = false;
  const session = {
    withTransaction: async (fn, opts) => {
      assert.equal(opts.readConcern.level, "snapshot");
      assert.equal(opts.writeConcern.w, "majority");
      assert.equal(opts.timeoutMS, 20000);
      return fn();
    },
    endSession: async () => {
      ended = true;
    },
  };
  const client = {
    db: () => ({
      collection: (name) => ({
        createIndex: async (...args) => calls.push(["index", name, ...args]),
        aggregate: (pipeline, opts) => {
          calls.push(["aggregate", name, pipeline, opts]);
          return { next: async () => ({ total: 75 }) };
        },
        findOne: async (query, opts) => {
          calls.push(["get", name, query, opts]);
          return null;
        },
        replaceOne: async (query, row, opts) => {
          calls.push(["put", name, query, row, opts]);
        },
      }),
    }),
    startSession: () => session,
  };
  const store = createAuraMongoStore(client, "isolated-test");
  await store.transaction(async (tx) => {
    await tx.get("AuraWallets", "member");
    assert.equal(await tx.reservedTotal("member"), 75);
    await tx.findOne("AuraCoupons", { codeHash: "hash" });
    await tx.put("AuraWallets", { _id: "member", balance: 10 });
  });
  assert.equal(ended, true);
  assert.equal(calls.filter((x) => x[0] === "index").length, 12);
  for (const call of calls.filter((x) =>
    ["get", "put", "aggregate"].includes(x[0]),
  ))
    assert.equal(call.at(-1).session, session);
  assert.ok(
    calls.some(
      (x) => x[0] === "index" && x[1] === "AuraCoupons" && x.at(-1).unique,
    ),
  );
});
test("Mongo adapter closes sessions on failure and never falls back to untransactional writes", async () => {
  let ended = 0,
    writes = 0;
  const client = {
    db: () => ({
      collection: () => ({
        createIndex: async () => {},
        replaceOne: async () => {
          writes++;
        },
      }),
    }),
    startSession: () => ({
      withTransaction: async () => {
        throw Error("transactions unsupported");
      },
      endSession: async () => {
        ended++;
      },
    }),
  };
  const store = createAuraMongoStore(client);
  await assert.rejects(
    store.transaction((tx) => tx.put("AuraWallets", { _id: "x", balance: 1 })),
    /unsupported/,
  );
  assert.equal(writes, 0);
  assert.equal(ended, 1);
});

test("Mongo group operations batch bounded reads and ordered writes in the transaction session", async () => {
  const calls = [];
  const session = { withTransaction: async (fn) => fn(), endSession: async () => {} };
  const client = {
    startSession: () => session,
    db: () => ({ collection: (name) => ({
      createIndex: async () => {},
      find: (query, opts) => {
        calls.push({ kind: "find", name, query, opts });
        return { toArray: async () => [{ _id: "a", balance: 1 }] };
      },
      aggregate: (pipeline, opts) => {
        calls.push({ kind: "aggregate", name, pipeline, opts });
        return { toArray: async () => [{ _id: "a", total: 2 }] };
      },
      bulkWrite: async (operations, opts) => calls.push({ kind: "bulk", name, operations, opts }),
    }) }),
  };
  await createAuraMongoStore(client).transaction(async (tx) => {
    assert.equal((await tx.getMany("AuraWallets", ["a"]))[0].balance, 1);
    assert.equal((await tx.reservedTotals(["a"])).get("a"), 2);
    await tx.putMany("AuraWallets", [{ _id: "a", balance: 1, heldAura: 2 }]);
    await tx.putMany("AuraLedger", [{ _id: "receipt" }]);
    assert.throws(() => tx.putMany("AuraWallets", [{ _id: "a", balance: -1 }]), /safety/);
  });
  assert.equal(calls.length, 4);
  for (const call of calls) assert.equal(call.opts.session, session);
  for (const call of calls.filter((x) => x.kind === "bulk")) {
    assert.equal(call.opts.ordered, true);
    assert.equal(call.operations[0].replaceOne.upsert, true);
  }
});
