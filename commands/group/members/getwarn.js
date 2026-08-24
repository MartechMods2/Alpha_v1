import dotenv from "dotenv";
dotenv.config();
import { extractPhoneNumber } from "../../../utils/lid.js";
import { getGroupData } from "../../../db/groupData.js";
import { getGroupSafetySettings } from "../../../utils/groupSafety.js";
import { getGroupWarningCount } from "../../../utils/moderation.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	let { senderJid, sendMessageWTyping, extendedMessageOriginal } = msgInfoObj;

	let taggedJid;
	if (!extendedMessageOriginal) {
		taggedJid = senderJid;
	} else {
		try {
			if (extendedMessageOriginal.participant)
				taggedJid = extendedMessageOriginal.participant;
			else taggedJid = extendedMessageOriginal.mentionedJid[0];
		} catch {
			taggedJid = senderJid;
		}
	}
	const groupData = await getGroupData(from);
	const warnCount = getGroupWarningCount(groupData, taggedJid);
	const { warningLimit, warningAction } = getGroupSafetySettings(groupData);
	// Use extractPhoneNumber for LID/PN compatibility
	let phoneNumber = extractPhoneNumber(taggedJid);
	let warnMsg;
	const bars = "🔴".repeat(Math.min(warnCount, warningLimit)) +
		"⚪".repeat(Math.max(0, warningLimit - warnCount));
	warnMsg =
		`⚠️ *Warning Status*\n\n@${phoneNumber}\n${bars} *(${warnCount}/${warningLimit})*\n\n` +
		(warnCount === 0
			? "_No warnings — keep it clean!_"
			: warnCount >= warningLimit
				? `_Limit reached — policy: ${warningAction}._`
				: "_Please follow the group rules._");
	sendMessageWTyping(from, { text: warnMsg, mentions: [taggedJid] }, { quoted: msg });
};

export default () => ({
	cmd: ["getwarn"],
	desc: "Get warning status of a member",
	usage: "getwarn | reply to a message to get warning status of that member",
	handler,
});
