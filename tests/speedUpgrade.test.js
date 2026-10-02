import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSingleFlight} from '../utils/singleFlight.js';
test('single flight shares concurrent work and releases both failures and completed values',async()=>{
  const flight=createSingleFlight();let calls=0,release;
  const block=new Promise(resolve=>{release=resolve;});
  const work=()=>{calls++;return block;};
  const a=flight('group',work),b=flight('group',work);
  assert.equal(a,b);release('metadata');assert.equal(await a,'metadata');assert.equal(calls,1);
  assert.equal(await flight('group',()=>{calls++;return 'fresh';}),'fresh');assert.equal(calls,2);
  await assert.rejects(flight('group',()=>{throw Error('offline');}),/offline/);
  assert.equal(await flight('group',()=> 'recovered'),'recovered');
});
test('dashboard combines concurrent GETs but never caches results or deduplicates writes',async t=>{
  let requests=0,release;
  t.mock.method(globalThis,'fetch',()=>{requests++;return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({fresh:requests})});});});
  const source=await readFile(new URL('../dashboard/src/lib/api.js',import.meta.url),'utf8');
  const {api}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const a=api.get('/same'),b=api.get('/same');assert.equal(a,b);assert.equal(requests,1);release();await a;
  const c=api.get('/same');assert.equal(requests,2);release();await c;
  const p=api.post('/same',{});const firstRelease=release;const q=api.post('/same',{});assert.equal(requests,4);firstRelease();release();await Promise.all([p,q]);
});
