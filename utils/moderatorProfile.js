import {isConfiguredModerator} from './moderatorProtection.js';
import {isSameGroupUser,normalizeUserJid} from './groupParticipants.js';
export const moderatorProfileJid=info=>{
  if(!(info?.isOwner||isConfiguredModerator(info?.groupMetadata,[info?.senderJid])))return null;
  const numbers=`${process.env.MY_NUMBER||''},${process.env.MODERATORS||''}`.split(',').map(s=>s.replace(/\D/g,'')).filter(Boolean);
  const canonical=numbers.map(n=>`${n}@s.whatsapp.net`).find(jid=>isSameGroupUser(info.groupMetadata,info.senderJid,[jid]));
  return canonical||normalizeUserJid(info.senderJid)||null;
};
