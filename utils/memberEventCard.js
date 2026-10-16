import { isSameGroupUser } from "./groupParticipants.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { publicRequest } from "./featureHttp.js";
import { getRank } from "./ranks.js";
import { extractPhoneNumber } from "./lid.js";
export async function memberEventPayload(
  sock,
  jid,
  participant,
  action,
  metadata,
  groupData,
  customText,
) {
  const entry = (groupData.members || []).find((x) =>
    isSameGroupUser(metadata, x.id, participant),
  );
  const rank = getRank(entry?.count || 0);
  const count = metadata?.participants?.length;
  const label =
    action === "add" ? "WELCOME TO THE GROUP" : "THANK YOU FOR BEING HERE";
  const caption = `╭─ ✦ *${action === "add" ? "WELCOME" : "FAREWELL"}*\n│ @${extractPhoneNumber(participant)}\n╰────────────\n\n${customText}\n\n🏠 ${metadata?.subject || groupData.grpName || "Our community"}\n👥 Members: ${Number.isInteger(count) ? count : "Unavailable"}\n🏅 Rank: ${rank.name}\n${action === "add" ? "📖 Read the group rules and introduce yourself." : "Wishing you well on your next chapter."}`;
  try {
    const c = createCanvas(1000, 440),
      ctx = c.getContext("2d");
    ctx.fillStyle = "#101827";
    ctx.fillRect(0, 0, 1000, 440);
    ctx.fillStyle = "#213447";
    ctx.fillRect(0, 0, 12, 440);
    ctx.fillStyle = "#71e4b1";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("ALPHA • COMMUNITY", 50, 52);
    ctx.font = "bold 29px sans-serif";
    ctx.fillText(label, 50, 125);
    const group = String(
      metadata?.subject || groupData.grpName || "Community",
    ).slice(0, 38);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(group, 50, 193, 650);
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(
      `Members: ${count ?? "—"}   |   Rank: ${rank.name}`,
      50,
      265,
      650,
    );
    ctx.font = "20px sans-serif";
    ctx.fillText(
      action === "add"
        ? "A new connection. A fresh beginning."
        : "Every member is part of our story.",
      50,
      350,
      650,
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(835, 220, 106, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#334155";
    ctx.fillRect(725, 110, 220, 220);
    let photo = false;
    try {
      const url = await sock.profilePictureUrl(participant, "image");
      if (url) {
        const r = await publicRequest(url, { maxBytes: 2 * 1024 * 1024 });
        const image = await loadImage(r.buffer);
        ctx.drawImage(image, 729, 114, 212, 212);
        photo = true;
      }
    } catch {}
    if (!photo) {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 58px sans-serif";
      ctx.fillText("A", 815, 241);
    }
    ctx.restore();
    return { image: c.toBuffer("image/png"), caption, mentions: [participant] };
  } catch {
    return { text: caption, mentions: [participant] };
  }
}
