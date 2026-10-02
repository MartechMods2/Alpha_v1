import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, createHmac } from 'node:crypto';
import { proto } from 'baileys';
import { decryptInteractivePollMessage } from '../utils/pollVoteDecrypt.js';
import { encodePollMessage } from '../utils/pollMessageStore.js';

const creator = '100@lid', voter = '200@lid', group = 'native@g.us', id = 'native-poll';
const secret = Buffer.alloc(32, 3);
const session = { _id: id, groupJid: group, creationMessage: encodePollMessage({ messageContextInfo: { messageSecret: secret } }), creationKey: { participant: creator } };
function encryptedMessage(selected = ['✅ Join game']) {
  const key0 = createHmac('sha256', Buffer.alloc(32)).update(secret).digest();
  const key = createHmac('sha256', key0).update(Buffer.concat([Buffer.from(id), Buffer.from(creator), Buffer.from(voter), Buffer.from('Poll Vote'), Buffer.from([1])])).digest();
  const iv = Buffer.alloc(12, 1);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${id}\0${voter}`));
  const hashes = selected.map(text => createHash('sha256').update(text).digest());
  const bytes = proto.Message.PollVoteMessage.encode({ selectedOptions: hashes }).finish();
  return { key: { id: 'vote-1', remoteJid: group, participant: '234200@s.whatsapp.net', participantAlt: voter }, message: { pollUpdateMessage: {
    pollCreationMessageKey: { id, remoteJid: group, fromMe: true }, senderTimestampMs: 1000000000000,
    vote: { encPayload: Buffer.concat([cipher.update(bytes), cipher.final(), cipher.getAuthTag()]), encIv: iv },
  } } };
}

test('native poll decoder authenticates real ciphertext using PN/LID identities', async () => {
  const message = encryptedMessage();
  const decoded = await decryptInteractivePollMessage({ sock: { user: { id: '234100:7@s.whatsapp.net', lid: creator } }, message, session });
  assert.equal(decoded.update.pollUpdates[0].pollUpdateMessageKey.participant, voter);
  assert.deepEqual(Buffer.from(decoded.update.pollUpdates[0].vote.selectedOptions[0]), createHash('sha256').update('✅ Join game').digest());
  assert.equal(decoded.update.pollUpdates[0].senderTimestampMs, 1000000000000);
});

test('decoder resolves missing own LID from the socket identity mapping', async () => {
  const mappedSession = { ...session, creationKey: {} };
  const decoded = await decryptInteractivePollMessage({ sock: { user: { id: '234100@s.whatsapp.net' }, signalRepository: { lidMapping: { getLIDForPN: async jid => jid === '234100@s.whatsapp.net' ? creator : null } } }, message: encryptedMessage(), session: mappedSession });
  assert.equal(decoded.update.pollUpdates[0].vote.selectedOptions.length, 1);
});

test('vote retraction decrypts as no selected options', async () => {
  const decoded = await decryptInteractivePollMessage({ sock: { user: { id: creator } }, message: encryptedMessage([]), session });
  assert.equal(decoded.update.pollUpdates[0].vote.selectedOptions.length, 0);
});

test('decoder rejects modified ciphertext, cross-chat votes and missing secrets', async () => {
  const modified = encryptedMessage();
  modified.message.pollUpdateMessage.vote.encPayload[0] ^= 1;
  await assert.rejects(decryptInteractivePollMessage({ sock: { user: { id: creator } }, message: modified, session }), /authentication failed/);
  const crossChat = encryptedMessage(); crossChat.key.remoteJid = 'other@g.us';
  assert.equal(await decryptInteractivePollMessage({ sock: {}, message: crossChat, session }), null);
  await assert.rejects(decryptInteractivePollMessage({ sock: {}, message: encryptedMessage(), session: { ...session, creationMessage: '{}' } }), /secret/);
});
