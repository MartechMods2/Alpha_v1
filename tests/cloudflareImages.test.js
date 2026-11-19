import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudflareImageGenerator,cloudflareImageStatus} from '../utils/cloudflareImage.js';
import {generateAlphaImage} from '../utils/alphaImage.js';
import {premiumReply} from '../utils/premiumReplies.js';
const jpeg=Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0]);
const env={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'synthetic-cloudflare-token'};
test('Cloudflare REST request uses fixed FLUX model and accepts base64 images',async()=>{
 let call;
 const generate=createCloudflareImageGenerator({env,fetcher:async(url,options)=>{call={url,options};return Response.json({success:true,result:{image:jpeg.toString('base64')}});}});
 const image=await generate('A sunny Lagos street');assert.equal(image.provider,'cloudflare');assert.deepEqual(image.buffer,jpeg);
 assert.equal(call.url,`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`);
 assert.deepEqual(JSON.parse(call.options.body),{prompt:'A sunny Lagos street',steps:4});assert.equal(call.options.redirect,'error');
 assert.equal(JSON.stringify(cloudflareImageStatus(env)).includes(env.CLOUDFLARE_API_TOKEN),false);
});
test('missing Cloudflare credentials fail before network calls',async()=>{
 let calls=0;const generate=createCloudflareImageGenerator({env:{},fetcher:async()=>{calls++;}});
 await assert.rejects(generate('A tree'),{code:'IMAGE_NOT_CONFIGURED'});assert.equal(calls,0);
});
test('Cloudflare quota errors cool down rather than repeatedly spending requests',async()=>{
 let calls=0;const generate=createCloudflareImageGenerator({env,fetcher:async()=>{calls++;return new Response('private quota details',{status:429});}});
 await assert.rejects(generate('A tree'),{code:'IMAGE_QUOTA'});await assert.rejects(generate('A tree'),{code:'IMAGE_QUOTA'});assert.equal(calls,1);
});
test('Cloudflare auth and malformed/oversized replies return safe actionable errors',async()=>{
 for(const status of [401,403]){
  const generate=createCloudflareImageGenerator({env,fetcher:async()=>new Response('secret provider response',{status})});
  await assert.rejects(generate('A tree'),error=>error.code==='IMAGE_AUTH'&&!error.message.includes('secret'));
 }
 const invalid=createCloudflareImageGenerator({env,fetcher:async()=>Response.json({success:true,result:{}})});
 await assert.rejects(invalid('A tree'),{code:'IMAGE_INVALID'});
 const tooLarge=createCloudflareImageGenerator({env,fetcher:async()=>new Response('x',{headers:{'content-length':String(40*1024*1024)}})});
 await assert.rejects(tooLarge('A tree'),{code:'IMAGE_TOO_LARGE'});
});
test('Cloudflare selection never falls back to paid providers or exhausted Gemini by default',async()=>{
 const keys=['ALPHA_IMAGE_PROVIDER','ALPHA_IMAGE_FALLBACK','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','OPENAI_API_KEY','GOOGLE_API_KEY'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const original=globalThis.fetch;let calls=0;
 try {
  process.env.ALPHA_IMAGE_PROVIDER='cloudflare';process.env.ALPHA_IMAGE_FALLBACK='false';
  delete process.env.CLOUDFLARE_ACCOUNT_ID;delete process.env.CLOUDFLARE_API_TOKEN;
  process.env.OPENAI_API_KEY='synthetic-openai';process.env.GOOGLE_API_KEY='synthetic-google';
  globalThis.fetch=async()=>{calls++;throw Error('must not call fallback');};
  await assert.rejects(generateAlphaImage('A sunny park'),{code:'IMAGE_NOT_CONFIGURED'});assert.equal(calls,0);
  await assert.rejects(generateAlphaImage(''),/add an image description/);assert.equal(calls,0);
 }finally {globalThis.fetch=original;for(const k of keys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
});
test('reply cards add spacing and art without changing copyable commands, URLs, code or branding twice',()=>{
 const body='✅ Settings updated\n\n$img a sunny park\nhttps://example.com/a?q=1';
 const result=premiumReply(body);assert.match(result,/✦  \*ALPHA\*  ✦/);assert.ok(result.includes(body));assert.equal(premiumReply(result),result);
 assert.equal(premiumReply('```js\nconst x = 1;\n```'),'```js\nconst x = 1;\n```');
 assert.equal((premiumReply('⚡Alpha⚡\n\nHello there!').match(/alpha/gi)||[]).length,1);
});
test('Cloudflare limits concurrent generations and releases slots after completion',async()=>{
 const releases=[];const generate=createCloudflareImageGenerator({env,fetcher:()=>new Promise(resolve=>releases.push(()=>resolve(Response.json({result:{image:jpeg.toString('base64')},success:true}))))});
 const a=generate('A tree'),b=generate('A park');
 await assert.rejects(generate('A river'),{code:'IMAGE_BUSY'});assert.equal(releases.length,2);
 releases.forEach(resolve=>resolve());await Promise.all([a,b]);
 const c=generate('A river');releases.at(-1)();await c;
});
