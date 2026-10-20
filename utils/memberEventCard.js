import { isSameGroupUser } from "./groupParticipants.js";
import { getRank } from "./ranks.js";
import { extractPhoneNumber } from "./lid.js";
import { alphaPanel, safeDisplayName } from "./alphaStyle.js";
import { profileMessage } from "./profileMessage.js";

export async function memberEventPayload(
  sock,
  jid,
  participant,
  action,
  metadata,
  groupData = {},
  customText = "",
) {
  const entry = (groupData.members || []).find((x) =>
    isSameGroupUser(metadata, x.id, participant),
  );
  const rank = getRank(entry?.count || 0);
  const count = metadata?.participants?.length;
  const welcome = action === "add";
  const caption = alphaPanel({
    icon: welcome ? "✦" : "◇",
    title: welcome ? "WELCOME · A NEW CHAPTER" : "FAREWELL · UNTIL NEXT TIME",
    lines: [
      `@${extractPhoneNumber(participant)}`,
      "",
      String(customText),
      "",
      `⌂ ${safeDisplayName(metadata?.subject || groupData.grpName || "Our community")}`,
      `👥 Members: ${Number.isInteger(count) ? count : "Unavailable"}`,
      `🏅 Rank: ${rank.name} · Recorded messages: ${Number(entry?.count || 0)}`,
    ],
    footer: welcome
      ? "Settle in, read the rules & introduce yourself. ✧"
      : "Thank you for being part of our story. ✧",
  });
  return profileMessage(sock, participant, caption, {
    mentions: [participant],
  });
}
