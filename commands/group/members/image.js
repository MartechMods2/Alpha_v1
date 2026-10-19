import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile,writeFile } from 'node:fs/promises';
import { downloadResolvedMedia } from '../../../utils/mediaInput.js';
import { withTempFiles } from '../../../utils/documentStudio.js';
import { getFfmpegPath } from '../../../utils/mediaStudio.js';
import { runMediaJob } from '../../../utils/mediaJobs.js';
const exec=promisify(execFile);
const handler=async(sock,msg,from,args,info)=>runMediaJob({feature:'toimg',groupJid:from,senderJid:info.senderJid,task:async()=>{
 const {buffer}=await downloadResolvedMedia(sock,msg,{allowedKinds:['sticker'],maxBytes:2*1048576});
 return withTempFiles(['.webp','.png'],async([input,output])=>{
  await writeFile(input,buffer);
  await exec(getFfmpegPath(),['-y','-max_alloc','67108864','-threads','1','-i',input,'-frames:v','1','-vf','scale=1280:1280:force_original_aspect_ratio=decrease',output],{timeout:20000,maxBuffer:128000});
  return info.sendMessageWTyping(from,{image:await readFile(output),caption:'Sent by Alpha — Martech'},{quoted:msg});
 });
}});
export default()=>({cmd:['image','toimg'],desc:'Convert a sticker to an image with bounded processing',usage:'image (reply to sticker)',handler});
