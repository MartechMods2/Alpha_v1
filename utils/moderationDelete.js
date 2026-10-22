import { normalizeUserJid, participantJids, isJidGroupAdmin, isGroupOwner } from "./groupParticipants.js";
import { claimDeletionBudget } from "./moderationCircuit.js";

export const deletionNotice = (result) => ({
  requested: "Message deletion requested.",
  "warn-only": "Warning-only mode: message kept. Use $automod antilink on delete to remove links.",
  "not-admin": "Message remains: Alpha needs group-admin permission to delete it.",
  limited: "Message remains: the deletion safety limit was reached. An admin should review it.",
  timeout: "Deletion could not be confirmed before timeout. An admin should check the message.",
  failed: "Message deletion failed. An admin should review it.",
  invalid: "The original group message could not be identified safely; nothing was deleted.",
  protected: "Automatic deletion skipped: this member is now an admin or owner.",
})[result?.status] || "";

export function moderationDeleteKey(msg, groupJid, memberJid) {
  const key = msg?.key;
  if (!key || key.fromMe || typeof key.id !== "string" || !key.id || key.id.length > 200 ||
      typeof groupJid !== "string" || !groupJid.endsWith("@g.us") || (key.remoteJid && key.remoteJid !== groupJid)) return null;
  const participant = key.participant || memberJid || key.participantAlt || key.participantPn;
  if (typeof participant !== "string" || !/^\d+(?::\d+)?@(s\.whatsapp\.net|lid|hosted|hosted\.lid)$/.test(participant)) return null;
  // Keep the actual author's PN/LID namespace. Never target a quoted status key.
  return { ...key, remoteJid: groupJid, participant, fromMe: false };
}

export function createModerationDeleter({ claim = claimDeletionBudget, now = () => Date.now(),
  sendTimeoutMs = 5000, metadataTimeoutMs = 3000 } = {}) {
  const roles = new Map(), flights = new Map();
  let activeSends = 0, activeMetadata = 0;
  const bound = async (promise, ms) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("Timed out"), { moderationTimeout: true })), ms);
    })]); } finally { clearTimeout(timer); }
  };
  const refresh = (sock, groupJid, fallback, force = false) => {
    const cached = roles.get(groupJid);
    if (!force && cached?.until > now()) return Promise.resolve(cached.metadata);
    if (cached?.pending) return cached.pending;
    if (typeof sock.groupMetadata !== "function" || activeMetadata >= 4) return Promise.resolve(fallback);
    activeMetadata++;
    const lookup = Promise.resolve().then(() => sock.groupMetadata(groupJid))
      .finally(() => { activeMetadata--; });
    const pending = bound(lookup, metadataTimeoutMs)
      .then((metadata) => {
        if ((metadata?.id && metadata.id !== groupJid) || !Array.isArray(metadata?.participants) || metadata.participants.length > 1024) throw Error("Invalid metadata");
        roles.set(groupJid, { metadata, until: now() + 10000 });
        return metadata;
      }).catch(() => { roles.delete(groupJid); return fallback; });
    while (roles.size >= 512) roles.delete(roles.keys().next().value);
    roles.set(groupJid, { pending });
    return pending;
  };
  const sendDelete = async (sock, groupJid, key) => {
    if (activeSends >= 4) return { status: "limited", deleted: false };
    activeSends++;
    const work = Promise.resolve().then(() => sock.sendMessage(groupJid, { delete: key }))
      .finally(() => { activeSends--; });
    await bound(work, sendTimeoutMs);
    return { status: "requested", deleted: true };
  };
  return async ({ sock, msg, groupJid, memberJid, groupMetadata, botJids = [], isBotAdmin, allowAdminTarget = false }) => {
    const key = moderationDeleteKey(msg, groupJid, memberJid);
    if (!key) return { status: "invalid", deleted: false };
    const id = `${groupJid}:${key.id}`;
    if (flights.has(id)) return flights.get(id);
    if (flights.size >= 128) return { status: "limited", deleted: false };
    const work = (async () => {
      let metadata = await refresh(sock, groupJid, groupMetadata);
      const bot = [...botJids, ...participantJids(sock.user), ...participantJids(sock.authState?.creds?.me)];
      const canDelete = (data) => data?.participants
        ? isJidGroupAdmin(data, bot) : isBotAdmin === true;
      const protectedMember = (data) => !allowAdminTarget && (isJidGroupAdmin(data, memberJid) || isGroupOwner(data, memberJid));
      if (protectedMember(metadata)) return { status: "protected", deleted: false };
      if (!canDelete(metadata)) return { status: "not-admin", deleted: false, isBotAdmin: false };
      if (!claim(groupJid)) return { status: "limited", deleted: false };
      try { return { ...await sendDelete(sock, groupJid, key), isBotAdmin: true }; }
      catch (error) {
        if (error.moderationTimeout) return { status: "timeout", deleted: false, isBotAdmin: true };
        // Refresh roles once and retry the SAME message key once. No retry loop.
        metadata = await refresh(sock, groupJid, metadata, true);
        if (protectedMember(metadata)) return { status: "protected", deleted: false };
        if (!canDelete(metadata)) return { status: "not-admin", deleted: false, isBotAdmin: false };
        try { return { ...await sendDelete(sock, groupJid, key), isBotAdmin: true }; }
        catch (retryError) { return { status: retryError.moderationTimeout ? "timeout" : "failed", deleted: false, isBotAdmin: true }; }
      }
    })();
    flights.set(id, work);
    try { return await work; } finally { flights.delete(id); }
  };
}
export const deleteModerationMessage = createModerationDeleter();

const notices = new Map();
export async function notifyDeletionProblem({ result, groupJid, sendMessageWTyping }) {
  if (!sendMessageWTyping || ["requested", "protected"].includes(result.status)) return;
  const now = Date.now();
  if ((notices.get(groupJid) || 0) > now) return;
  while (notices.size >= 512) notices.delete(notices.keys().next().value);
  notices.set(groupJid, now + 60000);
  await sendMessageWTyping(groupJid, { text: "🛡️ " + deletionNotice(result) }).catch(() => {});
}

export function participantActionSucceeded(results, target, matches = (a, b) => normalizeUserJid(a) === normalizeUserJid(b)) {
  return Array.isArray(results) && results.some((row) => matches(row?.jid || row?.id, target) && String(row?.status) === "200");
}
