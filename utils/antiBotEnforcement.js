import { participantJids, isSameGroupUser, isJidGroupAdmin, isGroupOwner } from './groupParticipants.js';
import { participantActionSucceeded } from './moderationDelete.js';
const flights = new Map(), recent = new Map();
// Only an administrator-confirmed block list authorizes automatic removal.
// Behaviour and message-ID guesses never authorize kicking a human.
export async function enforceConfirmedBot({sock, groupJid, memberJid, settings, botJids = [], force = false}) {
  if (!force && !settings.antiBotEnabled) return {status:'disabled'};
  const key = `${groupJid}:${memberJid}`;
  const now = Date.now();
  if (recent.get(key) > now) return {status:'cooldown'};
  if (flights.has(key)) return flights.get(key);
  if (flights.size >= 4) return {status:'limited'};
  const task = (async () => {
    let timeout;
    const work = (async () => {
      const metadata = await sock.groupMetadata(groupJid);
      if (metadata?.id && metadata.id !== groupJid) return {status:'invalid-group'};
      if (!(settings.blockedBotJids || []).some(jid => isSameGroupUser(metadata, memberJid, jid))) return {status:'unconfirmed'};
      const owners = String(process.env.MY_NUMBER || '').split(',').map(n=>n.replace(/\D/g,'')).filter(Boolean).map(n=>n+'@s.whatsapp.net');
      if (isGroupOwner(metadata, memberJid) || isJidGroupAdmin(metadata,memberJid) || isSameGroupUser(metadata,memberJid,[...botJids,...participantJids(sock.user),...participantJids(sock.authState?.creds?.me),...owners])) return {status:'protected'};
      const identities = [...botJids, ...participantJids(sock.user), ...participantJids(sock.authState?.creds?.me)];
      if (!isJidGroupAdmin(metadata, identities)) return {status:'not-admin'};
      const participant = (metadata.participants || []).find(p => participantJids(p).some(jid => isSameGroupUser(metadata, memberJid, jid)));
      if (!participant) return {status:'not-member'};
      const target = participantJids(participant)[0];
      const results = await sock.groupParticipantsUpdate(groupJid, [target], 'remove');
      return {status: participantActionSucceeded(results, target, (a,b)=>isSameGroupUser(metadata,a,b)) ? 'removed' : 'denied'};
    })();
    // A timed-out operation retains its concurrency slot until it actually ends.
    work.finally(() => { clearTimeout(timeout); flights.delete(key); }).catch(()=>{});
    try {
      const result = await Promise.race([work, new Promise(resolve=>{timeout=setTimeout(()=>resolve({status:'timeout'}),8000);})]);
      return result;
    } catch { return {status:'failed'}; }
    finally {
      for (const [id, until] of recent) if (until <= now) recent.delete(id);
      while (recent.size >= 1000) recent.delete(recent.keys().next().value);
      recent.set(key, now + 60000);
    }
  })();
  flights.set(key, task);
  return task;
}
export const botRemovalNotice = result => ({
  removed:'Confirmed bot removed from this group.',
  'not-admin':'Removal needs Alpha to be a group admin.',
  protected:'Removal skipped: this is an admin, owner or protected account.',
  'not-member':'This account is no longer a group member.',
  denied:'WhatsApp rejected removal. An admin should review the account.',
  timeout:'Removal timed out; check the member list before retrying.',
  limited:'Removal is busy; an admin should review the account.',
  failed:'Removal failed; an admin should review the account.',
  cooldown:'This account was checked recently; review its current membership.',
  disabled:'Anti-bot enforcement is off.',
  unconfirmed:'This account is not on the admin-confirmed bot list.',
})[result?.status] || 'An admin should review this account.';
