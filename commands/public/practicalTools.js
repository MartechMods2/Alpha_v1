import { PRACTICAL_TOOLS, runPracticalTool } from '../../utils/practicalTools.js';
const handler = async (_sock,msg,from,args,info) => {
  const prefix=info.prefix||'$';
  const reply=text=>info.sendMessageWTyping(from,{text},{quoted:msg});
  if(info.command==='toolshelp') {
    const category=args.join(' ').toLowerCase();
    if (!category) {
      const counts = Object.values(PRACTICAL_TOOLS).reduce((result, tool) => ({...result, [tool.category]: (result[tool.category] || 0) + 1}), {});
      return reply(`🧰 *115 Alpha Practical Tools*\n\n${Object.entries(counts).map(([name,count]) => `${name}: ${count}`).join('\n')}\n\nTry ${prefix}toolshelp text or ${prefix}toolshelp developer. The dashboard Command Guide has every example and offline test.`);
    }
    const rows=Object.values(PRACTICAL_TOOLS).filter(t=>!category||t.category.toLowerCase().includes(category));
    if(!rows.length)return reply('Categories: Text, Numbers, Geometry, Money arithmetic, Planning, Developer.');
    return reply(`🧰 *Alpha Practical Tools — ${rows.length} tools*\n\n${rows.map(t=>`${prefix}${t.name} ${t.example.replace(/\n/g,' ↵ ')}\n${t.description}`).join('\n\n')}\n\nUse actual new lines for ↵. These are offline helpers; money tools apply the values you supply.`);
  }
  const tool=PRACTICAL_TOOLS[info.command];
  if(!tool)return reply('Unknown tool.');
  const text=String(info.inputText??info.evv??args.join(' '));
  try{return await reply(`🧰 *${tool.description}*\n\n${runPracticalTool(info.command,text)}`);}
  catch(error){return reply(`❌ ${error.message}\nExample: ${prefix}${tool.name} ${tool.example}`);}
};
export default ()=>({cmd:[...Object.keys(PRACTICAL_TOOLS),'toolshelp'],desc:'Offline text, statistics, geometry, money arithmetic, planning and developer tools',usage:'toolshelp [category]',handler});
