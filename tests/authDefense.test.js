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
      .replace('from "baileys"', 'from "' + baileys + '"')
      .replace('from "../utils/extensionPolicy.js"', 'from ' + JSON.stringify(new URL("../utils/extensionPolicy.js", import.meta.url).href));
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
test("actual auth adapter stores encrypted tenant credentials and keys and reads them back",async()=>{
  const rows=new Map();globalThis.__extensionAuthRows=rows;
  const module=moduleURL(`const rows=globalThis.__extensionAuthRows;export default {db:()=>({collection:()=>({findOne:async q=>rows.get(q._id)||null,find:q=>({toArray:async()=>q._id.$in.map(id=>rows.get(id)).filter(Boolean)}),updateOne:async(q,u)=>rows.set(q._id,{_id:q._id,...u.$set}),bulkWrite:async ops=>{for(const op of ops){if(op.updateOne)rows.set(op.updateOne.filter._id,{_id:op.updateOne.filter._id,...op.updateOne.update.$set});if(op.deleteOne)rows.delete(op.deleteOne.filter._id);}}})})};`);
  const baileys=moduleURL('export const BufferJSON={reviver:(_k,v)=>v,replacer:(_k,v)=>v};export const initAuthCreds=()=>({testSecret:"private-fixture"});export const proto={Message:{AppStateSyncKeyData:{fromObject:v=>v}}};');
  let source=await readFile(new URL("../core/auth.js",import.meta.url),"utf8");
  source=source.replace('from "../db/client.js"','from '+JSON.stringify(module)).replace('from "baileys"','from '+JSON.stringify(baileys)).replace('from "../utils/extensionPolicy.js"','from '+JSON.stringify(new URL("../utils/extensionPolicy.js",import.meta.url).href));
  source=source.replace('process.env.ALPHA_EXTENSION_ID','"abcdefabcdefabcdefabcdef"').replace('process.env.ALPHA_EXTENSION_AUTH_KEY || process.env.MONGODB_KEY','"synthetic-auth-secret-at-least-32-characters"');
  const {useMongoDBAuthState}=await import(moduleURL(source));
  let auth;
  try{
    auth=await useMongoDBAuthState();await auth.saveCreds();
    await auth.state.keys.set({session:{fixture:{secret:"session-fixture"}}});
    assert.ok(!rows.get("creds").value.includes("private-fixture"));
    assert.ok(!rows.get("session-fixture").value.includes("session-fixture"));
    assert.deepEqual(await auth.state.keys.get("session",["fixture"]),{fixture:{secret:"session-fixture"}});
    await auth.cleanup();auth=await useMongoDBAuthState();assert.equal(auth.state.creds.testSecret,"private-fixture");
  }finally{await auth?.cleanup();delete globalThis.__extensionAuthRows;}
});
