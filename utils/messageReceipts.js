import { BoundedTtlMap } from './boundedTtlMap.js';

const normalize = (jid) => typeof jid === 'string' ? jid.replace(/:\d+@/, '@') : '';
const timestamp = (value) => {
  const n = Number(value?.toNumber?.() ?? value);
  return Number.isFinite(n) && n > 0 && n < 1e12 ? n : undefined;
};
export function createReceiptTracker({ now = Date.now, max = 200, ttl = 86400000, maxReaders = 256 } = {}) {
  const messages = new BoundedTtlMap({ max, ttl, now });
  return {
    record(updates) {
      if (!Array.isArray(updates)) return;
      for (const { key, receipt } of updates.slice(0, 512).filter(Boolean)) {
        if (key?.fromMe !== true || !/^\d[\d-]*@g\.us$/.test(key.remoteJid || '') ||
            typeof key.id !== 'string' || !key.id || key.id.length > 128) continue;
        const user = normalize(receipt?.userJid);
        if (!/^\d+@(s\.whatsapp\.net|lid)$/.test(user)) continue;
        const delivered = timestamp(receipt.receiptTimestamp);
        const read = timestamp(receipt.readTimestamp);
        const played = timestamp(receipt.playedTimestamp);
        if (!delivered && !read && !played) continue;
        const id = `${key.remoteJid}:${key.id}`;
        let item = messages.get(id);
        if (item && now() - item.createdAt >= ttl) { messages.delete(id); item = undefined; }
        item ||= { createdAt: now(), users: new Map() };
        if (!item.users.has(user) && item.users.size >= maxReaders) continue;
        const old = item.users.get(user) || {};
        const next = { ...old };
        for (const [field, value] of Object.entries({ delivered, read, played }))
          if (value) next[field] = Math.max(old[field] || 0, value);
        item.users.set(user, next);
        messages.set(id, item);
      }
    },
    get(group, id) {
      const item = messages.get(`${group}:${id}`);
      if (!item || now() - item.createdAt >= ttl) return [];
      return [...item.users].map(([jid, data]) => ({ jid, ...data }));
    },
    clear() { messages.clear(); },
  };
}
export const messageReceipts = createReceiptTracker();

export async function receiptReport(sock, msg, from, args, info, tracker = messageReceipts) {
  const reply = (text) => info.sendMessageWTyping(from, { text }, { quoted: msg });
  if (!info.isGroup) return reply('Use this command in a group, replying to a message sent by Alpha’s linked account.');
  if (!info.isOwner && !info.isGroupAdmin) return reply('Only group admins or Alpha’s owner can request receipt reports.');
  const context = info.extendedMessageOriginal;
  if (!context?.stanzaId) return reply('Reply to a message sent by Alpha’s linked account and use $readby [page].');
  if (context.remoteJid && context.remoteJid !== from) return reply('The quoted message must belong to this group.');
  const own = new Set([...(info.botJids || []), sock.user?.id, sock.user?.lid].map(normalize).filter(Boolean));
  if (!own.has(normalize(context.participant)))
    return reply('Alpha can only report receipts for messages sent by its own linked WhatsApp account. It cannot inspect messages sent by your separate account.');
  const merged = new Map();
  for (const receipt of tracker.get(from, context.stanzaId)) {
    const member = info.groupMetadata?.participants?.find((p) =>
      [p.id, p.lid, p.phoneNumber].map(normalize).includes(receipt.jid));
    const canonical = normalize(member?.id) || receipt.jid;
    const old = merged.get(canonical) || { jid: canonical };
    for (const field of ['read', 'delivered', 'played'])
      if (receipt[field]) old[field] = Math.max(old[field] || 0, receipt[field]);
    merged.set(canonical, old);
  }
  const rows = [...merged.values()];
  if (!rows.length) return reply('✦ *Message receipts*\n\nNo receipts recorded for this message. Alpha records new receipt events while running; older messages and receipts from before a restart may be unavailable. This does not mean nobody read it.');
  const page = Math.max(1, Number.parseInt(args?.[0], 10) || 1);
  const sorted = rows.sort((a, b) => Number(Boolean(b.read || b.played)) - Number(Boolean(a.read || a.played)) || a.jid.localeCompare(b.jid));
  const pages = Math.ceil(rows.length / 20);
  if (page > pages) return reply(`Use a page between 1 and ${pages}.`);
  const readCount = rows.filter((r) => r.read || r.played).length;
  const label = (jid) => {
    const member = info.groupMetadata?.participants?.find((p) => [p.id, p.lid, p.phoneNumber].map(normalize).includes(jid));
    const name = String(member?.notify || member?.name || '').replace(/[\r\n*_~`]/g, '').slice(0, 60);
    return name || (jid.endsWith('@lid') ? `Member ID ${jid.split('@')[0]}` : `+${jid.split('@')[0]}`);
  };
  const time = (seconds) => new Date(seconds * 1000).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', dateStyle: 'short', timeStyle: 'short' });
  const lines = sorted.slice((page - 1) * 20, page * 20).map((r) => {
    const seen = r.read || r.played;
    return `${seen ? '✓✓ Read' : '✓ Delivered'} · ${label(r.jid)}\n${time(seen || r.delivered)} WAT`;
  });
  return reply(`✦ *Message receipts*\n\nRead: *${readCount}*\nDelivered, read not recorded: *${rows.length - readCount}*\n\n${lines.join('\n\n')}\n\nPage ${page}/${pages} · $readby ${Math.min(page + 1, pages)}\nOnly received receipts are shown. Missing receipts do not prove a member has not read it. Up to 256 recipients per message are retained. Records expire after 24 hours and reset on restart.`);
}
