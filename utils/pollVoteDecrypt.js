import { decryptPollVote, jidNormalizedUser, normalizeMessageContent } from 'baileys';
import { decodePollMessage } from './pollMessageStore.js';

export const rawPollUpdate = message => normalizeMessageContent(message?.message)?.pollUpdateMessage || null;
const userJids = values => [...new Set(values.filter(Boolean).map(value => jidNormalizedUser(String(value))))]
  .filter(jid => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'));
const selfJids = sock => userJids([sock?.user?.id, sock?.user?.lid, sock?.authState?.creds?.me?.id, sock?.authState?.creds?.me?.lid]);

// Baileys 7.0.0-rc14 receives encrypted pollUpdateMessage in upsert, but its
// automatic messages.update poll-decryption branch is commented out. Decode
// here and feed the same enrollment handler used by decoded update events.
export const decryptInteractivePollMessage = async ({ sock, message, session }) => {
  const update = rawPollUpdate(message);
  const creationKey = update?.pollCreationMessageKey;
  if (!creationKey?.id || creationKey.id !== session._id || message.key?.remoteJid !== session.groupJid ||
      (creationKey.remoteJid && creationKey.remoteJid !== session.groupJid)) return null;
  if (!update.vote?.encPayload?.length || !update.vote?.encIv?.length) throw new Error('Encrypted poll vote payload is missing');
  const creation = normalizeMessageContent(decodePollMessage(session.creationMessage));
  const secret = creation?.messageContextInfo?.messageSecret;
  if (!secret?.length) throw new Error('Original poll secret is unavailable');

  // PN/LID aliases are cryptographic identities, not interchangeable strings.
  // Try only identities belonging to the actual creator and sender. GCM
  // authentication determines which identity WhatsApp used to encrypt the vote.
  const own = selfJids(sock);
  const creators = userJids([...own, session.creationKey?.participant, session.creationKey?.participantAlt]);
  const voters = userJids(message.key.fromMe ? own : [message.key.participant, message.key.participantAlt, message.key.participantPn, message.key.remoteJidAlt]);
  if (!voters.length) throw new Error('Poll voter identity is unavailable');
  const attempt = () => {
    for (const creator of creators) for (const voter of voters) {
      try {
        const vote = decryptPollVote(update.vote, { pollCreatorJid: creator, pollMsgId: session._id, pollEncKey: secret, voterJid: voter });
        return { key: { id: session._id, remoteJid: session.groupJid }, update: { pollUpdates: [{
          pollUpdateMessageKey: { ...message.key, participant: voter }, vote,
          senderTimestampMs: Number(update.senderTimestampMs?.toNumber?.() ?? update.senderTimestampMs ?? message.messageTimestamp * 1000) || Date.now(),
        }] } };
      } catch {} // An alias mismatch fails authenticated decryption; try the next.
    }
    return null;
  };
  let decoded = attempt();
  if (decoded) return decoded;
  const mapping = sock?.signalRepository?.lidMapping;
  if (mapping?.getLIDForPN) {
    for (const jid of [...creators]) if (jid.endsWith('@s.whatsapp.net')) {
      const lid = await mapping.getLIDForPN(jid).catch(() => null);
      if (lid && !creators.includes(lid)) creators.push(...userJids([lid]));
    }
    for (const jid of [...voters]) if (jid.endsWith('@s.whatsapp.net')) {
      const lid = await mapping.getLIDForPN(jid).catch(() => null);
      if (lid && !voters.includes(lid)) voters.push(...userJids([lid]));
    }
    decoded = attempt();
  }
  if (!decoded) throw new Error('Poll vote authentication failed for the available creator/voter identities');
  return decoded;
};
