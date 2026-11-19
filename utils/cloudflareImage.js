const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const MAX_BYTES = 20 * 1024 * 1024;
export function cloudflareImageConfig(env = process.env) {
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = String(env.CLOUDFLARE_API_TOKEN || '').trim();
  return {accountId,token,model:MODEL,configured:/^[a-f0-9]{32}$/i.test(accountId) && Boolean(token)};
}
export function cloudflareImageStatus(env = process.env) {
  const config=cloudflareImageConfig(env);
  return {cloudflare:config.configured,cloudflareModel:MODEL,
    cloudflareMissing:[!config.accountId?'CLOUDFLARE_ACCOUNT_ID':!/^[a-f0-9]{32}$/i.test(config.accountId)?'valid CLOUDFLARE_ACCOUNT_ID':null,!config.token?'CLOUDFLARE_API_TOKEN':null].filter(Boolean)};
}
const fail=(code,message,status)=>Object.assign(new Error(message),{code,status});
async function boundedBody(response,max=MAX_BYTES*1.4) {
  const length=Number(response.headers.get('content-length') || 0);
  if(length>max){await response.body?.cancel();throw fail('IMAGE_TOO_LARGE','Cloudflare returned an oversized response');}
  if(!response.body)return Buffer.alloc(0);
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>max){await reader.cancel();throw fail('IMAGE_TOO_LARGE','Cloudflare returned an oversized response');}chunks.push(value);}}
  finally{reader.releaseLock();}
  return Buffer.concat(chunks,bytes);
}
export function createCloudflareImageGenerator({fetcher=(...a)=>fetch(...a),env=process.env}={}) {
  let active=0,blockedUntil=0;
  return async prompt => {
    const config=cloudflareImageConfig(env);
    if(!config.configured)throw fail('IMAGE_NOT_CONFIGURED','Cloudflare image generation needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Render. Use $imgstatus after adding them.');
    if(Date.now()<blockedUntil)throw fail('IMAGE_QUOTA','Cloudflare is temporarily rate-limited. Please try again later.',429);
    if(active>=2)throw fail('IMAGE_BUSY','Two images are already being generated. Please try again shortly.',429);
    active++;
    try {
      const response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.model}`,{
        method:'POST',redirect:'error',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},
        body:JSON.stringify({prompt,steps:4}),signal:AbortSignal.timeout(90000),
      });
      if(!response.ok){
        await response.body?.cancel();
        if(response.status===429){blockedUntil=Date.now()+60000;throw fail('IMAGE_QUOTA','Cloudflare image quota or rate limit was reached. Check Workers AI usage; no paid fallback was used.',429);}
        if([401,403].includes(response.status))throw fail('IMAGE_AUTH','Cloudflare denied access. Check the account ID and Workers AI token permissions.',response.status);
        throw fail('IMAGE_PROVIDER_ERROR',`Cloudflare image service returned HTTP ${response.status}.`,response.status);
      }
      const body=await boundedBody(response);
      let buffer=body;
      if((response.headers.get('content-type') || '').includes('json')){
        let data;try{data=JSON.parse(body.toString('utf8'));}catch{throw fail('IMAGE_INVALID','Cloudflare returned invalid image data');}
        if(data.success===false)throw fail('IMAGE_PROVIDER_ERROR','Cloudflare rejected image generation. Check Workers AI configuration and usage.');
        const encoded=data.result?.image || data.image;
        if(typeof encoded!=='string' || encoded.length>MAX_BYTES*1.4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw fail('IMAGE_INVALID','Cloudflare returned no supported image data');
        buffer=Buffer.from(encoded,'base64');
      }
      if(!buffer.length || buffer.length>MAX_BYTES)throw fail('IMAGE_INVALID','Cloudflare returned an empty or oversized image');
      return {buffer,provider:'cloudflare',model:config.model};
    } finally {active--;}
  };
}
export const generateCloudflareImage=createCloudflareImageGenerator();
