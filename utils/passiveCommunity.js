import messageQueue from "../queue/messageQueue.js";
import { getGroupData } from "../db/groupData.js";
import { handlePassiveScoredGameAnswer } from "../commands/group/members/scoredGames.js";
import { maybeJoinActiveConversation, recordHumanActivity } from "./humanEngagement.js";
import { handleExplicitAlphaDelivery } from "./alphaDeliveryRouter.js";
import {
  formatVibeCheck,
  generateDesireGame,
  generateRizzReplies,
  maybeSendConsentReminder,
  recordDesireActivity,
} from "./desireHub.js";

const creatorName = String(process.env.ALPHA_CREATOR_NAME || "Martech").trim() || "Martech";
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const creatorNamePattern = new RegExp(`(?:^|\\s|@)${escapeRegExp(creatorName)}(?:\\b|$)`, "i");
const commandPrefix = String(process.env.PREFIX || "$");

const bodyOf = (msg) => {
  const message = msg?.message || {};
  return String(
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    "",
  );
};

const contextInfoOf = (msg) => {
  const message = msg?.message || {};
  return message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.documentMessage?.contextInfo ||
    {};
};

const digits = (value) => String(value || "").replace(/\D/g, "");
const configuredCreatorNumbers = () => String(process.env.MY_NUMBER || process.env.CREATOR_NUMBER || "")
  .split(/[,;\s]+/)
  .map(digits)
  .filter(Boolean);

const isCreatorTagged = (msg, body) => {
  if (creatorNamePattern.test(body)) return true;
  const owners = configuredCreatorNumbers();
  if (!owners.length) return false;
  const mentioned = contextInfoOf(msg)?.mentionedJid || [];
  return mentioned.some((jid) => {
    const candidate = digits(String(jid).split("@")[0]);
    return owners.some((owner) => candidate === owner || candidate.endsWith(owner) || owner.endsWith(candidate));
  });
};

const reactionFor = (msg) => {
  const seed = String(msg?.key?.id || msg?.key?.participant || "Martech");
  let sum = 0;
  for (const char of seed) sum = (sum + char.charCodeAt(0)) % 997;
  return sum % 2 === 0 ? "👑" : "⚡";
};

const reactCreatorMention = async (sock, msg, from, body) => {
  if (!isCreatorTagged(msg, body)) return;
  await messageQueue.enqueue(
    from,
    () => sock.sendMessage(from, { react: { text: reactionFor(msg), key: msg.key } }),
    0,
  ).catch(() => {});
};

const handleDesireSlashShortcut = async ({ sock, msg, from, senderJid, body }) => {
  const match = body.match(/^\/(rizz|rizzcoach|game|desiregame|vibecheck|vibe|energy)(?:\s+([\s\S]*))?$/i);
  if (!match) return false;
  const data = await getGroupData(from).catch(() => null);
  if (!data?.desireHubEnabled) return false;
  const command = match[1].toLowerCase();
  const input = String(match[2] || "").trim();
  let text;
  if (["vibecheck", "vibe", "energy"].includes(command)) text = formatVibeCheck(from);
  else if (["rizz", "rizzcoach"].includes(command)) text = await generateRizzReplies({ groupJid: from, senderJid, context: input });
  else text = await generateDesireGame({ groupJid: from, type: input });
  await sock.sendMessage(from, { text }, { quoted: msg });
  return true;
};

export const handlePassiveCommunityMessage = async (sock, msg) => {
  const from = msg?.key?.remoteJid || "";
  if (!from.endsWith("@g.us") || msg?.key?.fromMe || !msg?.message) return false;
  const body = bodyOf(msg).trim();
  if (!body) return false;
  const senderJid = msg?.key?.participant || msg?.key?.participantPn || msg?.key?.participantAlt || contextInfoOf(msg)?.participant || "";

  if (senderJid) {
    recordHumanActivity({ groupJid: from, senderJid, body });
    if (!body.startsWith(commandPrefix) && !body.startsWith("/") && !body.startsWith("#")) {
      recordDesireActivity({ groupJid: from, senderJid, body });
    }
  }
  await reactCreatorMention(sock, msg, from, body);
  void maybeSendConsentReminder({ sock, groupJid: from, senderJid, body }).catch((error) => console.warn("[DESIRE CONSENT]", error.message));

  if (senderJid && await handleExplicitAlphaDelivery({ sock, msg, groupJid: from, senderJid, body })) return true;
  if (senderJid && await handleDesireSlashShortcut({ sock, msg, from, senderJid, body })) return true;

  if (!body.startsWith("#") || body.length < 2) {
    void maybeJoinActiveConversation({ sock, msg, groupJid: from }).catch((error) => console.warn("[HUMAN ENGAGEMENT] active join skipped:", error.message));
    return false;
  }

  const answer = body.slice(1).trim();
  if (!answer || !senderJid) return false;
  return handlePassiveScoredGameAnswer({
    sock,
    msg,
    from,
    answer,
    senderJid,
    updateName: msg.pushName || String(senderJid).split("@")[0],
  });
};
