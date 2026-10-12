import {cleanupRuntime,runtimePerformance} from '../../utils/runtimeMaintenance.js';
export default()=>({cmd:['alphaclean','alphaperf'],desc:'Safely expire idle runtime cache entries and inspect memory/queue pressure',usage:'alphaclean | alphaperf',handler:async(_sock,msg,from,_args,info)=>{
  const clean=info.command==='alphaclean'?cleanupRuntime():null;
  const p=runtimePerformance();
  return info.sendMessageWTyping(from,{text:`⚡ *Alpha runtime*\nHeap: ${p.heapMB} MB\nProcess memory: ${p.rssMB} MB\nQueued messages: ${p.queue.totalQueued}\nActive sends: ${p.queue.activeSends}\nFile cache: ${p.files.sizeMB}/${p.files.maxSizeMB} MB\n${clean?`Expired cache entries: ${clean.expiredCacheEntries}\nExpired file entries: ${clean.expiredFileEntries}\n`:''}\nCleanup preserves active sends, games, settings and WhatsApp authentication. Provider/network delays require separate diagnosis.`},{quoted:msg});
}});
