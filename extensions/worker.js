import { extensionId } from "../utils/extensionPolicy.js";
const phone=process.env.ALPHA_EXTENSION_PHONE;
if (!phone || extensionId(phone)!==process.env.ALPHA_EXTENSION_ID || !process.send) throw Error("Invalid extension worker launch");
// This entry point starts no dashboard, public pairing endpoint or child manager.
const [{default:socket},{default:events},{default:NodeCache},{createConnectionManager},{setSock},{default:client}] = await Promise.all([
  import("../core/socket.js"),import("../core/events.js"),import("node-cache"),import("../utils/connectionManager.js"),import("../core/socketRef.js"),import("../db/client.js"),
]);
const cache=new NodeCache({stdTTL:300,checkperiod:60,maxKeys:300,useClones:false});
let current, codeRequested=false, closing=false;
const manager=createConnectionManager({create:socket,onSocket:sock=>{current=sock;setSock(sock);},attach:async(sock,start)=>{
  await events(sock,start,cache);
  sock.ev.on("connection.update", update=>{
    if (update.connection==="close") process.send?.({type:"closed"});
    if (update.connection==="open") {
      const actual=String(sock.authState?.creds?.me?.id || sock.user?.id || "").replace(/:\d+@/,"@");
      if(actual!==`${phone}@s.whatsapp.net`) return void shutdown(1);
      process.send?.({type:"open"});
    }
    if (update.qr && !sock.authState?.creds?.registered && !codeRequested) {
      codeRequested=true;
      void sock.requestPairingCode(phone).then(code=>process.send?.({type:"code",code})).catch(()=>shutdown(1));
    }
  });
}});
async function shutdown(code=0){
  if(closing)return;closing=true;manager.stop();cache.close();
  const kill=setTimeout(()=>process.exit(code),5000);kill.unref();
  try{await current?.flushAuth?.();await client.close();}catch{}process.exit(code);
}
process.on("SIGTERM",()=>shutdown());process.on("SIGINT",()=>shutdown());process.on("disconnect",()=>shutdown());
process.on("alpha:fatal",()=>shutdown(1));process.on("unhandledRejection",()=>shutdown(1));process.on("uncaughtException",()=>shutdown(1));
const monitor=setInterval(()=>{if(manager.stats().stopped)void shutdown(1);},30000);monitor.unref();
await manager.start();
