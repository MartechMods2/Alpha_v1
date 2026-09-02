import { detectSmartIntent, SMART_INTENT_EXAMPLES, smartIntentSummary } from "../../utils/smartIntent.js";

const safe=(value,max=400)=>String(value||"").replace(/[\r\n\t*_~`]/g," ").replace(/\s+/g," ").trim().slice(0,max);
const help=(prefix)=>{const groups=smartIntentSummary();return `🧠 *Alpha Smart Request*\n\nJust tell me what you want:\n\n${SMART_INTENT_EXAMPLES.map((row)=>`• ${row}`).join("\n")}\n\n*Recognised automatically*\nMedia: ${groups.media.join(", ")}\nUtilities: ${groups.utilities.join(", ")}\nGroups: ${groups.groups.join(", ")}\n\nGroup: tag Alpha, for example *@Alpha send me Asake - Forgiveness*.\nPrivate chat: type naturally, or use *${prefix}do <request>* anywhere.`;};

export const runSmartIntent=async({intent,sock,msg,from,info})=>{
	const {commandsPublic,commandsMembers}=await import("../../utils/commandLoader.js");
	if(!intent||intent.command==="do")return false;
	const target=commandsPublic[intent.command]||(info.isGroup?commandsMembers[intent.command]:null);
	if(!target)return false;
	await target(sock,msg,from,intent.args,{...info,command:intent.command,evv:intent.args.join(" ")});
	return true;
};

const handler=async(sock,msg,from,args,info)=>{
	if(["smarthelp","intenthelp","examples","recommend","quickhelp","whatcanido"].includes(info.command))return info.sendMessageWTyping(from,{text:help(info.prefix)},{quoted:msg});
	if(info.command==="intentstatus")return info.sendMessageWTyping(from,{text:`🧠 *Smart Intent Status*\n\nPrivate natural recognition: *${String(process.env.SMART_DM_INTENTS||"true").toLowerCase()!=="false"?"ON":"OFF"}*\nGroup recognition: *ON when Alpha is tagged/replied to*\nRecognised families: *22*\nFallback: *normal Alpha conversation*\n\nNo ordinary group message activates the router.`},{quoted:msg});
	const text=args.join(" ").trim();if(!text)return info.sendMessageWTyping(from,{text:help(info.prefix)},{quoted:msg});
	const intent=detectSmartIntent(text,{isGroup:info.isGroup});
	if(info.command==="intenttest")return info.sendMessageWTyping(from,{text:intent?`🧪 Recognised as *${intent.label}* → *${info.prefix}${intent.command} ${intent.args.join(" ")}*`:`🧪 No high-confidence intent detected. Alpha would treat this as normal conversation.`},{quoted:msg});
	if(!intent)return info.sendMessageWTyping(from,{text:`🤔 I could not safely identify that request. Try *${info.prefix}smarthelp* for natural examples, or say exactly what you want, such as “send music”, “show lyrics”, “weather in Lagos” or “calculate”.`},{quoted:msg});
	try{return await runSmartIntent({intent,sock,msg,from,info});}catch(error){return info.sendMessageWTyping(from,{text:`❌ ${safe(error.message)}`},{quoted:msg});}
};

export default()=>({cmd:["do","smart","findit","getme","smarthelp","intenthelp","examples","intentstatus","intenttest","recommend","quickhelp","whatcanido"],desc:"Recognise natural requests and run the correct safe bot feature",usage:"do <what you want> | smarthelp | intenttest <request>",handler});
