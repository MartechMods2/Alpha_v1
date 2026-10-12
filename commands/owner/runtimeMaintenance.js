import { privateChatTarget } from '../../utils/privateGuide.js';
import { moderatorProfileJid } from '../../utils/moderatorProfile.js';
import messageQueue from '../../queue/messageQueue.js';
import {cleanupRuntime,runtimePerformance} from '../../utils/runtimeMaintenance.js';
export default()=>({cmd:['alphaclean','alphaperf'],desc:'Safely expire idle runtime cache entries and inspect memory/queue pressure',usage:'alphaclean | alphaperf',handler:async(_sock,msg,from,_args,info)=>{
  const target=privateChatTarget(moderatorProfileJid(info));
  const clean=info.command==='alphaclean'?cleanupRuntime():null;
  const p=runtimePerformance();
  await messageQueue.enqueue(target,()=>_sock.sendMessage(target,{text:`⚡ *Alpha runtime*\nHeap: ${p.heapMB} MB\nProcess memory: ${p.rssMB} MB\nQueued messages: ${p.queue.totalQueued}\nActive sends: ${p.queue.activeSends}\nFile cache: ${p.files.sizeMB}/${p.files.maxSizeMB} MB\n${clean?`Expired cache entries: ${clean.expiredCacheEntries}\nExpired file entries: ${clean.expiredFileEntries}\n`:''}\nCleanup preserves active sends, games, settings and WhatsApp authentication. Provider/network delays require separate diagnosis.`}),0);
  if(from.endsWith("@g.us"))return info.sendMessageWTyping(from,{text:"📩 Runtime report sent to your personal chat."},{quoted:msg});
}});
