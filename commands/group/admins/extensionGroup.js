import { isJidGroupAdmin } from "../../../utils/groupParticipants.js";
import { group } from "../../../db/groupData.js";
export default () => ({
  cmd:["groupalpha"],desc:"Group admins enable or pause an Alpha extension in their group",usage:"groupalpha on|off",
  handler:async(sock,msg,from,args,info)=>{
    const reply=text=>info.sendMessageWTyping(from,{text});
    if(!process.env.ALPHA_EXTENSION_ID)return reply("This command is for paired extensions. Manage the original Alpha with its existing creator controls.");
    if(!info.isGroup)return reply("Only a group admin can enable Alpha here.");
    if(!info.isOwner){
      try{
        const metadata=await sock.groupMetadata(from);
        if(!isJidGroupAdmin(metadata,[info.senderJid,msg.key?.participantPn,msg.key?.participantAlt].filter(Boolean)))return reply("Only a current group admin can enable Alpha here.");
      }catch{return reply("Alpha could not verify current group permissions. No settings changed; try again shortly.");}
    }
    if(args.length!==1 || !["on","off"].includes(args[0]))return reply("Use $groupalpha on or $groupalpha off.");
    const enabled=args[0]==="on";
    await group.updateOne({_id:from},{$set:{isBotOn:enabled,isChatBotOn:enabled}});
    return reply(`Alpha extension is ${enabled?"ON":"OFF"} in this group. ${enabled?"Use $menu for commands. Group permissions and usage limits still apply.":"A group admin can re-enable it with $groupalpha on."}`);
  },
});
