import { downloadResolvedMedia } from "../../../utils/mediaInput.js";
import {
  createSafeItem,
  listSafeItems,
  updateSafeItem,
  removeSafeItem,
} from "../../../db/safePackData.js";
const handler = async (sock, msg, from, args, info) => {
  const send = (payload) =>
      info.sendMessageWTyping(from, payload, { quoted: msg }),
    admin = info.isOwner || info.isGroupAdmin;
  if (!info.isGroup)
    return send({ text: "Reaction libraries belong to a group." });
  const rows = await listSafeItems(from, "reaction-sticker", {}, 40);
  if (info.command === "reactionadd") {
    const tag = args[0];
    if (!["thanks", "celebrate", "comfort", "laugh", "greeting"].includes(tag))
      return send({
        text: "Reply to a sticker: reactionadd thanks|celebrate|comfort|laugh|greeting. Only submit stickers you have permission to share.",
      });
    if (rows.length >= 30)
      return send({
        text: "Library is full (30). An admin can remove an old contribution.",
      });
    const media = await downloadResolvedMedia(sock, msg, {
      allowedKinds: ["sticker"],
      maxBytes: 512000,
    });
    const item = await createSafeItem({
      groupJid: from,
      type: "reaction-sticker",
      memberJid: info.senderJid,
      text: tag,
      payload: { data: media.buffer.toString("base64") },
      status: admin ? "approved" : "pending",
    });
    return send({
      text: `Sticker ${item._id}: ${admin ? "approved" : "submitted for admin approval"}. It can be used only in this group.`,
    });
  }
  if (info.command === "reactionlist")
    return send({
      text:
        rows.map((x) => `${x._id} • ${x.text} • ${x.status}`).join("\n") ||
        "No contributed reaction stickers.",
    });
  const item = rows.find((x) => x._id === args[0]);
  if (!item)
    return send({
      text: "Use reactionlist, then provide the exact sticker ID.",
    });
  if (info.command === "reactionapprove") {
    if (!admin)
      return send({ text: "Administrators approve reaction stickers." });
    await updateSafeItem(from, "reaction-sticker", item._id, {
      status: "approved",
    });
    return send({ text: "Sticker approved." });
  }
  if (info.command === "reactiondelete") {
    if (!admin && item.memberJid !== info.senderJid)
      return send({ text: "Only its contributor or an admin can remove it." });
    await removeSafeItem(from, "reaction-sticker", item._id);
    return send({ text: "Sticker removed." });
  }
};
export default () => ({
  cmd: ["reactionadd", "reactionlist", "reactionapprove", "reactiondelete"],
  desc: "Consensual group-local reaction sticker library with admin approval",
  usage:
    "reactionadd laugh (reply to sticker) | reactionlist | reactionapprove <id>",
  handler,
});
