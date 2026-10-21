import { withAuraSenderAliases } from "./identity.js";
// Silent rewards run after input validation and group moderation, within the
// existing bounded ingestion handler. No extra queue, message body storage or reply.
export function createGroupTextRewards({ engine, store, resolveIdentity,
  now = () => Date.now(), onError = () => {} }) {
  let lastError = -Infinity;
  return async ({ sock, msg, senderJid, groupMetadata, botJids = [], groupEnabled = true }) => {
    try {
    const chat = msg?.key?.remoteJid;
    const content = msg?.message;
    const text = typeof content?.conversation === "string" ? content.conversation :
      content?.extendedTextMessage?.text;
    if (groupEnabled === false || typeof chat !== "string" || !chat.endsWith("@g.us") ||
        msg?.key?.fromMe || !msg?.key?.id || !senderJid || botJids.includes(senderJid) ||
        typeof text !== "string" || !text.replace(/\p{C}/gu, "").trim()) return;
    // Notify events can contain reconnect backlog. Do not reward old history.
    const stamp = typeof msg.messageTimestamp?.toNumber === "function"
      ? msg.messageTimestamp.toNumber() : Number(msg.messageTimestamp);
    if (!Number.isFinite(stamp) || stamp * 1000 < now() - 120000 ||
        stamp * 1000 > now() + 30000) return;
      // Cheap OFF check avoids identity resolution and wallet writes.
      if ((await store.get("AuraSettings", "economy"))?.enabled !== true) return;
      const actor = await resolveIdentity(sock, withAuraSenderAliases({ senderJid, groupMetadata }, msg));
      if (engine.owned(actor) || botJids.includes(actor)) return;
      return await engine.rewardGroupText(actor, chat, msg.key.id);
    } catch {
      // One aggregate diagnostic per minute, no sender/content/session details.
      if (now() - lastError >= 60000) {
        lastError = now();
        try { onError(); } catch {}
      }
    }
  };
}
