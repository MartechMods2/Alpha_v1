import {readFile} from 'node:fs/promises';
import {cmdToText} from '../../utils/commandLoader.js';
import {buildCommandGuide} from '../../utils/commandGuide.js';
import {getBotData} from '../../db/botData.js';
import {member} from '../../db/members.js';
import {moderatorProfileJid} from '../../utils/moderatorProfile.js';
import {MODERATOR_MODES} from '../../utils/moderatorModes.js';
import {privateChatTarget,renderPrivateGuide} from '../../utils/privateGuide.js';
import {runtimePerformance} from '../../utils/runtimeMaintenance.js';
import messageQueue from '../../queue/messageQueue.js';
import {notifyAlphaOwnerFailure} from '../../utils/alphaErrorReporter.js';
const active=new Set(),cooldowns=new Map();
const handler=async(sock,msg,from,args,info)=>{
  const prefix=info.prefix||'$',command=info.command;
  const profile=moderatorProfileJid(info);
  if(!profile)return info.sendMessageWTyping(from,{text:'This private console is for the creator and configured moderators.'},{quoted:msg});
  let target;
  try{target=privateChatTarget(profile);}catch{return info.sendMessageWTyping(from,{text:'Alpha could not determine your personal chat.'},{quoted:msg});}
  const send=payload=>messageQueue.enqueue(target,()=>sock.sendMessage(target,payload),0);
  try{
    if(command==='privateguide'){
      const now=Date.now();for(const [jid,until]of cooldowns)if(until<=now)cooldowns.delete(jid);
      if(active.has(target)||(cooldowns.get(target)||0)>now){await send({text:'A guide was recently requested. Please wait up to two minutes before requesting another.'});return;}
      active.add(target);cooldowns.set(target,now+120000);
      try{
        const [registry,bot]=await Promise.all([cmdToText(),getBotData()]);
        const paths=[...new Set(Object.values(registry).flat().map(row=>row.source).filter(Boolean))];
        const sources=await Promise.all(paths.map(async path=>[path,await readFile(new URL(`../../${path}`,import.meta.url),'utf8').catch(()=> '')]));
        let rows=buildCommandGuide({commands:registry,prefix,disabled:bot?.disabledGlobally||[],sourceText:Object.fromEntries(sources)});
        const query=args.join(' ').toLowerCase();if(query&&query!=='all')rows=rows.filter(row=>`${row.name} ${row.description} ${row.category}`.toLowerCase().includes(query));
        if(!rows.length){await send({text:'No commands matched. Use privateguide all for the complete guide.'});return;}
        await send({document:Buffer.from(renderPrivateGuide(rows,prefix),'utf8'),mimetype:'text/plain',fileName:'Alpha-Complete-Command-Guide.txt',caption:`${rows.length} commands with access, usage and examples. Saved here in your personal chat.`});
      }catch(error){cooldowns.delete(target);throw error;}finally{active.delete(target);}
    }else if(command==='privatemode'){
      const mode=String(args[0]||'status').toLowerCase();
      if(mode==='list'||mode==='help'){await send({text:`Moderator modes:\n${Object.entries(MODERATOR_MODES).map(([name,text])=>`${name}: ${text}`).join('\n\n')}\n\n${prefix}privatemode savage\n${prefix}privatemode status\n${prefix}privatemode off\nApplies to your alpha/gemini replies, not other members. Responses still need an operational AI provider.`});return;}
      if(mode==='status'){const row=await member.findOne({_id:profile});await send({text:`Your moderator mode: ${row?.moderatorSupportMode||'normal'}`});return;}
      const selected=mode==='off'?'normal':mode;if(!MODERATOR_MODES[selected]){await send({text:`Unknown mode. Use ${prefix}privatemode list.`});return;}
      await member.updateOne({_id:profile},{$set:{moderatorSupportMode:selected}},{upsert:true});await send({text:`Moderator mode saved: ${selected}. Only your own alpha/gemini requests use this style.`});
    }else if(command==='privatehealth'){
      const p=runtimePerformance();await send({text:`Alpha private runtime report\nHeap: ${p.heapMB} MB\nProcess memory: ${p.rssMB} MB\nQueued: ${p.queue.totalQueued}\nActive sends: ${p.queue.activeSends}\nFile cache: ${p.files.sizeMB} MB\nLast cleanup: ${p.lastCleanup?.at||'not run'}\nNo credentials or conversation content included.`});
    }
    if(from.endsWith('@g.us'))await info.sendMessageWTyping(from,{text:'📩 Sent to your personal chat.'},{quoted:msg});
  }catch(error){notifyAlphaOwnerFailure({sock,scope:'private-console',error});await info.sendMessageWTyping(from,{text:'Alpha could not complete the private request. Please try again.'},{quoted:msg});}
};
export default()=>({cmd:['privateguide','privatemode','privatehealth'],desc:'Creator/moderator private command guide, personal support modes and private runtime reports',usage:'privateguide all | privateguide security | privatemode list | privatemode savage | privatemode status | privatemode off | privatehealth',handler});
