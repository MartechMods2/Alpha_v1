import { createSafeItem, listSafeItems } from "../../../db/safePackData.js";
import { cleanSafeText } from "../../../utils/safePack.js";

const handler = async (sock, msg, from, args, info) => {
	const reply = (text) => info.sendMessageWTyping(from, { text }, { quoted: msg });
	const text = cleanSafeText(args.join(" "), 500);
	if (!text) return reply("❌ Usage: `appeal <why this warning should be reviewed>`.");
	const existing = await listSafeItems(from, "warning-appeal", { memberJid: info.senderJid, status: "pending" }, 1);
	if (existing.length) return reply("⏳ You already have a pending appeal.");
	await createSafeItem({ groupJid: from, type: "warning-appeal", memberJid: info.senderJid, memberName: info.updateName, text, status: "pending" });
	return reply("✅ Your warning appeal was sent to the group administrators.");
};

export default () => ({ cmd: ["appeal"], desc: "Submit one warning appeal for administrator review", usage: "appeal <reason>", handler });

