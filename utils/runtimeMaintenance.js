import fileCache from './fileCache.js';
import messageQueue from '../queue/messageQueue.js';
const caches=new Map();
let timer=null,lastCleanup=null;
export const cleanupRuntime=()=>{
  let expired=0;
  for(const cache of caches.keys()){
    // Only expire entries whose own TTL elapsed; never flush live data.
    const keys=cache.keys?.()||[];
    const before=keys.length,now=Date.now();
    for(const key of keys.slice(0,5000)){
      const ttl=cache.getTtl?.(key);
      if(typeof ttl==='number'&&ttl>0&&ttl<=now)cache.del?.(key);
    }
    expired+=Math.max(0,before-(cache.keys?.().length||0));
  }
  const beforeFiles=fileCache.cache.size;
  fileCache.evictStaleEntries();
  messageQueue.cleanupEmptyQueues();
  lastCleanup={at:new Date().toISOString(),expiredCacheEntries:expired,expiredFileEntries:beforeFiles-fileCache.cache.size};
  return lastCleanup;
};
export const registerRuntimeCache=cache=>{
  if(!cache)return ()=>{};
  caches.set(cache,(caches.get(cache)||0)+1);
  if(!timer){timer=setInterval(()=>{try{cleanupRuntime();}catch(e){console.warn('[MAINTENANCE]',e.message);}},60000);timer.unref?.();}
  let released=false;
  return ()=>{if(released)return;released=true;const count=(caches.get(cache)||1)-1;if(count)caches.set(cache,count);else caches.delete(cache);if(!caches.size&&timer){clearInterval(timer);timer=null;}};
};
export const runtimePerformance=()=>{
  const memory=process.memoryUsage();
  return {heapMB:Math.round(memory.heapUsed/1048576),rssMB:Math.round(memory.rss/1048576),uptimeSeconds:Math.round(process.uptime()),queue:messageQueue.getStats(),files:fileCache.getStats(),registeredCaches:caches.size,lastCleanup};
};
// A slow tick must finish before the next tick can start. Errors release the guard.
export const preventOverlap=work=>{
  let running=false;
  return async(...args)=>{if(running)return false;running=true;try{await work(...args);return true;}finally{running=false;}};
};
