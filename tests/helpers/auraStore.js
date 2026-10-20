import { createAuraEngine } from "../../utils/aura/engine.js";
const owner = "2348000000000@s.whatsapp.net";
export function setup() {
  let data = new Map(),
    queue = Promise.resolve(),
    clock = new Date("2026-10-20T07:00:00Z");
  const k = (c, id) => c + ":" + id;
  const get = async (c, id) => structuredClone(data.get(k(c, id)) || null);
  const put = async (c, row) => {
    data.set(k(c, row._id), structuredClone(row));
  };
  const match = (row, query) =>
    Object.entries(query).every(([name, value]) => row[name] === value);
  const store = {
    get,
    put,
    find: async (c, q) =>
      [...data.entries()]
        .filter(([id, r]) => id.startsWith(c + ":") && match(r, q))
        .map(([, r]) => structuredClone(r)),
    transaction(fn) {
      const work = queue.then(async () => {
        const snapshot = structuredClone(data);
        try {
          return await fn({
            get,
            put,
            findOne: async (c, q) => (await store.find(c, q))[0] || null,
          });
        } catch (e) {
          data = snapshot;
          throw e;
        }
      });
      queue = work.catch(() => {});
      return work;
    },
  };
  const engine = createAuraEngine(store, {
    owner: () => owner,
    now: () => clock,
  });
  return {
    engine,
    store,
    advance: (days) => {
      clock = new Date(+clock + days * 86400000);
    },
    setTime: (date) => {
      clock = new Date(date);
    },
  };
}
