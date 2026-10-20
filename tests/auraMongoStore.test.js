import test from "node:test";
import assert from "node:assert/strict";
import { createAuraMongoStore } from "../utils/aura/mongoStore.js";
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
    await tx.findOne("AuraCoupons", { codeHash: "hash" });
    await tx.put("AuraWallets", { _id: "member", balance: 10 });
  });
  assert.equal(ended, true);
  assert.equal(calls.filter((x) => x[0] === "index").length, 9);
  for (const call of calls.filter((x) => ["get", "put"].includes(x[0])))
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
