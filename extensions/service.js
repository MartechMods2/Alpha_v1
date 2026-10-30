import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import client from "../db/client.js";
import { getSock } from "../core/socketRef.js";
import { createExtensionManager } from "../utils/extensionManager.js";
const registry = client.db("MyBotDataDB").collection("AlphaExtensions");
export const extensions = createExtensionManager({
  store: {
    enabled: async value => {
      if (value !== undefined) await registry.updateOne({_id:"settings"},{$set:{enabled:value}},{upsert:true});
      return (await registry.findOne({_id:"settings"}))?.enabled === true;
    },
    list: () => registry.find({_id:{$ne:"settings"}}).limit(101).toArray(),
    put: row => registry.replaceOne({_id:row._id},row,{upsert:true}),
  },
  notify: (phone,text) => {
    const sock=getSock();
    if (!sock?.user) throw Error("Primary connection unavailable");
    return sock.sendMessage(`${phone}@s.whatsapp.net`,{text});
  },
  launch: (row, callbacks) => {
    const child=spawn(process.versions.bun ? "node" : process.execPath,["--max-old-space-size=256",fileURLToPath(new URL("./worker.js",import.meta.url))],{
      cwd:fileURLToPath(new URL("../",import.meta.url)),
      env:{...process.env,ALPHA_EXTENSION_ID:row._id,ALPHA_EXTENSION_PHONE:row.phone,USE_REDIS:"false",BOT_NUMBER:row.phone,MODERATORS:"",ALPHA_INGEST_QUARANTINE_FILE:`temp/extensions/${row._id}/quarantine.json`,ALPHA_PRIVATE_CHAT:"true"},
      stdio:["ignore","ignore","ignore","ipc"],
    });
    child.on("message",callbacks.message);
    child.once("exit",callbacks.exit);
    child.once("error",()=>{console.warn("[EXTENSIONS] Worker launch failed.");callbacks.exit();});
    return {stop:()=>new Promise(resolve=>{
      if(!child.pid || child.exitCode!==null || child.signalCode!==null) return resolve();
      const timer=setTimeout(()=>{child.kill("SIGKILL");},5000);timer.unref();
      child.once("exit",()=>{clearTimeout(timer);resolve();});child.kill("SIGTERM");
    })};
  },
});
