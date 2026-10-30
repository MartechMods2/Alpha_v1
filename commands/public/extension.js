import { auraIdentity } from "../../utils/aura/identity.js";
export default () => ({
  cmd:["extension"],desc:"Pair your own WhatsApp account with an isolated Alpha extension",usage:"extension pair|status|stop · creator: extension on|off|revoke NUMBER",
  handler:async(sock,msg,from,args,info)=>{
    const reply=text=>info.sendMessageWTyping(from,{text});
    if(process.env.ALPHA_EXTENSION_ID) return reply("Manage extensions in a private chat with the original Alpha bot.");
    if(info.isGroup || !String(from).endsWith("@s.whatsapp.net") && !String(from).endsWith("@lid")) return reply("For privacy, send $extension in a private chat with Alpha.");
    try{
      const actor=await auraIdentity(sock,info), phone=actor.split("@")[0];
      const own=String(process.env.MY_NUMBER||"").split(",")[0].replace(/[^0-9]/g,"");
      const action=args[0]||"help";
      if(action==="revoke" && phone===own && args.length===2 && /^\d{7,15}$/.test(args[1])) {
        const {extensions}=await import("../../extensions/service.js");await extensions.revoke(args[1]);return reply("Extension stopped and blocked from pairing again.");
      }
      if(args.length>1) return reply("Use $extension pair, status or stop. Do not supply another person's phone number.");
      if ((action==="on" || action==="off") && phone!==own) return reply("Only the configured creator can enable or pause extensions.");
      const {extensions}=await import("../../extensions/service.js");
      if(action==="on" || action==="off") {
        if(phone!==own) return reply("Only the configured creator can enable or pause extensions.");
        const r=await extensions.enable(action==="on");return reply(`Extensions ${r.enabled?"ON":"OFF"}. Capacity: ${r.max}. Members may use $extension pair privately to pair their own number.`);
      }
      if(action==="pair"){
        const bot=String(sock.authState?.creds?.me?.id || sock.user?.id || "").replace(/:\d+@/,"@");
        if(actor===bot || actor===String(process.env.BOT_NUMBER||"").replace(/\D/g,"")+"@s.whatsapp.net")return reply("The original Alpha number cannot pair as an extension.");
        await extensions.pair(phone);return reply("Preparing your private pairing code. Only link a number you own. Use $extension status to check progress.");
      }
      if(action==="stop"){await extensions.stop(phone);return reply("Your extension is stopped. Encrypted credentials are retained for resuming. To revoke the device permanently, remove Alpha from WhatsApp → Linked devices.");}
      if(action==="status"){const r=await extensions.status(phone);return reply(`Extensions: ${r.enabled?"ON":"OFF"}\nYour extension: ${r.status}\nServer capacity: ${r.max}`);}
      return reply("🔌 Alpha Extensions\n$extension pair — link your own number\n$extension status — your connection\n$extension stop — stop your extension\nCreator: $extension on / off; $extension revoke NUMBER (international digits)\nSeparate data and sessions; no creator permissions or unlimited Aura. Pairing codes are private. Remove the device from WhatsApp Linked devices to revoke access.");
    }catch{return reply("Extension action could not complete. Check that extensions are ON, a slot is free and your identity is verified. Use $extension status or ask the creator to review hosting capacity.");}
  },
});
