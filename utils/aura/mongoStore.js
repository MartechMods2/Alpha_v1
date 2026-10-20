import { assertAuraWallet } from "./walletSafety.js";
export function createAuraMongoStore(client, database = "MyBotDataDB") {
  const db = client.db(database);
  let ready;
  const ensure = () =>
    (ready ||= Promise.all([
      db.collection("AuraWallets").createIndex({ xp: -1 }),
      db.collection("AuraLedger").createIndex({ actor: 1, at: -1 }),
      db
        .collection("AuraCoupons")
        .createIndex({ codeHash: 1 }, { unique: true }),
      db.collection("AuraCharges").createIndex({ status: 1, expiresAt: 1 }),
      db.collection("AuraCharges").createIndex({ actor: 1, status: 1 }),
      db.collection("AuraDuels").createIndex({ state: 1, expiresAt: 1 }),
      ...[
        "AuraLimits",
        "AuraQuests",
        "AuraSettings",
        "AuraAppeals",
        "AuraDuels",
      ].map((name) => db.collection(name).createIndex({ updatedAt: 1 })),
    ]).catch((e) => {
      ready = null;
      throw e;
    }));
  const assertWallet = (name, row) => {
    if (name === "AuraWallets") assertAuraWallet(row);
  };
  const store = {
    get: (name, id) => db.collection(name).findOne({ _id: id }),
    find: (name, query, sort = {}, limit = 10) =>
      db
        .collection(name)
        .find(query)
        .sort(sort)
        .limit(Math.max(1, Math.min(100, limit)))
        .toArray(),
    put: async (name, row) => {
      await ensure();
      assertWallet(name, row);
      return db
        .collection(name)
        .replaceOne({ _id: row._id }, row, { upsert: true });
    },
    transaction: async (fn) => {
      await ensure();
      const session = client.startSession();
      try {
        return await session.withTransaction(
          () =>
            fn({
              get: (name, id) =>
                db.collection(name).findOne({ _id: id }, { session }),
              findOne: (name, query) =>
                db.collection(name).findOne(query, { session }),
              reservedTotal: async (actor) => {
                const row = await db
                  .collection("AuraCharges")
                  .aggregate(
                    [
                      { $match: { actor, status: "reserved" } },
                      { $group: { _id: null, total: { $sum: "$amount" } } },
                    ],
                    { session, maxTimeMS: 5000 },
                  )
                  .next();
                return row?.total ?? 0;
              },
              put: (name, row) => {
                assertWallet(name, row);
                return db
                  .collection(name)
                  .replaceOne({ _id: row._id }, row, { upsert: true, session });
              },
            }),
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            maxCommitTimeMS: 10000,
            timeoutMS: 20000,
          },
        );
      } finally {
        await session.endSession();
      }
    },
  };
  return store;
}
