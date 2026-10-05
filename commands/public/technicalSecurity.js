import {TECHNICAL_TOOLS,runTechnicalTool,lookupDkim} from '../../utils/technicalSecurity.js';
import {claimOsintQuota,normalizeDomain} from '../../utils/passiveOsint.js';
const handler=async(_sock,msg,from,args,info)=>{
  const prefix=info.prefix||'$';const reply=text=>info.sendMessageWTyping(from,{text},{quoted:msg});
  if(info.command==='techsechelp')return reply(`🛡️ *Technical Security Toolkit*\n\n${Object.values(TECHNICAL_TOOLS).map(t=>`${t.description}`).join('\n')}\n\n${Object.entries(TECHNICAL_TOOLS).map(([name,t])=>`${prefix}${name} ${t.example}`).join('\n\n')}\n\n${prefix}dkimlookup example.com selector\nPublic DNS lookup only; other tools analyze text locally. Paste public or redacted data, not passwords or private keys.`);
  if(String(process.env.SECURITY_TOOLS_ENABLED||'true').toLowerCase()==='false')return reply('Security tools are disabled by the owner.');
  try{
    if(info.command==='dkimlookup'){
      const domain=normalizeDomain(args[0]),selector=args[1];
      if(!domain||!selector||selector.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(selector)||args.length!==2)throw Error('Use dkimlookup example.com selector.');
      const quota=claimOsintQuota(info.senderJid);if(!quota.allowed)return reply('Public lookup limit reached. Try again later.');
      const result=await lookupDkim(domain,selector);
      return reply(`DKIM TXT: ${selector}._domainkey.${domain}\n\n${result||'No records.'}\n\nA published key does not establish that an email signature is valid.`);
    }
    return reply(runTechnicalTool(info.command,info.inputText??info.evv??args.join(' ')));
  }catch(error){console.warn('[TECH_SECURITY]',error.message);return reply(`Technical check failed: ${error.message}`);}
};
export default()=>({cmd:['techsechelp','dkimlookup',...Object.keys(TECHNICAL_TOOLS)],desc:'Public DKIM lookup and local email, SSH, container, certificate and assessment-scope reviews',usage:'techsechelp | dkimlookup example.com selector | spfreview <record> | dmarcreview <record> | mailheaderreview <headers> | sshaudit <config> | dockeraudit <config> | gitignoreaudit <rules> | pemaudit <certificate> | ioccompare <first list> | <second list> | pentestscope <targets>',handler});
