import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import fileCache,{FileCache} from '../utils/fileCache.js';
import queue from '../queue/messageQueue.js';
import {cleanupRuntime,registerRuntimeCache,preventOverlap,runtimePerformance} from '../utils/runtimeMaintenance.js';
test('file replacement accounting remains accurate and TTL reads reject expired buffers',()=>{
  const cache=new FileCache(10);clearInterval(cache.cleanupInterval);
  cache.set('a',Buffer.alloc(6));cache.set('a',Buffer.alloc(4));assert.equal(cache.currentSize,4);assert.equal(cache.cache.size,1);
  assert.equal(cache.set('oversized',Buffer.alloc(11)),false);assert.equal(cache.currentSize,4);
  cache.cache.get('a').lastAccess=Date.now()-cache.maxAge-1;assert.equal(cache.get('a'),null);assert.equal(cache.currentSize,0);
});
test('runtime cleanup deletes only expired entries and preserves active queues and caches',()=>{
  const entries=new Map([['live',Date.now()+60000],['expired',Date.now()-1],['permanent',0]]);
  const cache={keys:()=>[...entries.keys()],getTtl:k=>entries.get(k),del:k=>entries.delete(k)};
  const release=registerRuntimeCache(cache);
  queue.queues.set('active@g.us',[]);queue.processing.set('active@g.us',true);
  fileCache.set('fresh',Buffer.from('keep'));fileCache.set('old',Buffer.from('expire'));fileCache.cache.get('old').lastAccess=Date.now()-fileCache.maxAge-1;
  try{const result=cleanupRuntime();assert.equal(result.expiredCacheEntries,1);assert.equal(result.expiredFileEntries,1);assert.equal(entries.has('live'),true);assert.equal(entries.has('permanent'),true);assert.equal(queue.queues.has('active@g.us'),true);assert.ok(fileCache.get('fresh'));assert.equal(runtimePerformance().registeredCaches,1);}
  finally{release();queue.queues.delete('active@g.us');queue.processing.delete('active@g.us');fileCache.clear();}
});
test('overlap guard skips simultaneous jobs and releases after failure',async()=>{
  let release,calls=0;const blocked=new Promise(resolve=>{release=resolve;});
  const run=preventOverlap(async()=>{calls++;await blocked;});const first=run();assert.equal(await run(),false);assert.equal(calls,1);release();assert.equal(await first,true);assert.equal(await run(),true);
  let fail=true;const retry=preventOverlap(async()=>{if(fail)throw Error('temporary');});await assert.rejects(retry(),/temporary/);fail=false;assert.equal(await retry(),true);
});
test('event path never forces GC or flushes live caches',async()=>{
  const source=await readFile(new URL('../core/events.js',import.meta.url),'utf8');assert.doesNotMatch(source,/global\.gc\(|cache\.flushAll\(/);
});
