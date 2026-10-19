import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const moduleURL = (code) =>
  "data:text/javascript;base64," + Buffer.from(code).toString("base64");
test("auth flush failures retain buffered state for retry and null key updates delete stored keys", async () => {
  globalThis.__authDefense = { fail: false, operations: [] };
  try {
    const db = moduleURL(
      `export default {db:()=>({collection:()=>({findOne:async()=>null,bulkWrite:async ops=>{if(globalThis.__authDefense.fail)throw Error('mock storage failure');globalThis.__authDefense.operations.push(ops);},updateOne:async()=>{}})})};`,
    );
    const baileys = moduleURL(
      "export const BufferJSON={reviver:(_k,value)=>value,replacer:(_k,value)=>value};export const initAuthCreds=()=>({});export const proto={Message:{AppStateSyncKeyData:{fromObject:value=>value}}};",
    );
    let source = await readFile(
      new URL("../core/auth.js", import.meta.url),
      "utf8",
    );
    source = source
      .replace('from "../db/client.js"', 'from "' + db + '"')
      .replace('from "baileys"', 'from "' + baileys + '"');
    const { useMongoDBAuthState } = await import(moduleURL(source));
    const auth = await useMongoDBAuthState();
    await auth.state.keys.set({ cache: { one: { value: "synthetic" } } });
    globalThis.__authDefense.fail = true;
    await assert.rejects(auth.cleanup());
    assert.equal(globalThis.__authDefense.operations.length, 0);
    globalThis.__authDefense.fail = false;
    await auth.cleanup();
    assert.equal(
      globalThis.__authDefense.operations[0][0].updateOne.filter._id,
      "cache-one",
    );
    await auth.state.keys.set({ session: { old: null } });
    assert.equal(
      globalThis.__authDefense.operations.at(-1)[0].deleteOne.filter._id,
      "session-old",
    );
  } finally {
    delete globalThis.__authDefense;
  }
});
