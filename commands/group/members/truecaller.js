import dotenv from "dotenv";
dotenv.config();
const TRUECALLER_ID = process.env.TRUECALLER_ID || "";
import truecallerjs from "truecallerjs";
import { extractPhoneNumber, getPNFromLID, isLID } from "../../../utils/lid.js";
import { participantJids } from "../../../utils/groupParticipants.js";
import { lookupNumberHelp, normalizeLookupNumber } from "../../../utils/phoneNumber.js";

export const resolveLookupTarget = async (sock, jid, groupMetadata) => {
	if (!jid) return "";
	if (!isLID(jid)) return extractPhoneNumber(jid);
	const mapped = await getPNFromLID(sock, jid);
	if (mapped) return extractPhoneNumber(mapped);
	const participant = (groupMetadata?.participants || []).find((entry) => participantJids(entry).includes(jid));
	const phoneJid = participantJids(participant).find((alias) => alias.endsWith("@s.whatsapp.net"));
	return phoneJid ? extractPhoneNumber(phoneJid) : "";
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { prefix, sendMessageWTyping, extendedMessageOriginal, groupMetadata } = msgInfoObj;

	if (!TRUECALLER_ID) return sendMessageWTyping(from, { text: "```Truecaller ID is Missing```" }, { quoted: msg });

	let rawNumber;
	const mentionedJid = extendedMessageOriginal?.mentionedJid?.[0]
		|| extendedMessageOriginal?.contextInfo?.mentionedJid?.[0];
	if (mentionedJid) {
		rawNumber = await resolveLookupTarget(sock, mentionedJid, groupMetadata);
	} else if (extendedMessageOriginal?.participant) {
		rawNumber = await resolveLookupTarget(sock, extendedMessageOriginal.participant, groupMetadata);
	} else {
		rawNumber = args.join(" ").trim();
	}
	if (!rawNumber) return sendMessageWTyping(from, { text: `❌ WhatsApp did not expose that tagged member's phone number. Type the number directly instead.\n\n${lookupNumberHelp(prefix)}` }, { quoted: msg });
	const normalized = normalizeLookupNumber(rawNumber);
	if (!normalized) return sendMessageWTyping(from, { text: `❌ That phone number is not valid.\n\n${lookupNumberHelp(prefix)}` }, { quoted: msg });

	const searchData = {
		number: normalized.e164,
		countryCode: normalized.countryCode,
		installationId: TRUECALLER_ID,
	};

	const response = await truecallerjs.search(searchData).catch(() => null);
	if (!response) return sendMessageWTyping(from, { text: `❌ Number not found or Truecaller rejected the request.` }, { quoted: msg });
	const data = response.json?.()?.data?.[0];
	if (!data?.phones?.[0]) return sendMessageWTyping(from, { text: `❌ Number not found` }, { quoted: msg });

	const name = response.getName();
	const { e164Format, numberType, countryCode, carrier, type } = data.phones[0];
	const { city } = response.getAddresses()[0] || {};
	const email = response.getEmailId();

	const message = `🔍 *Truecaller Result*\n\n👤 *Name:* ${name}\n📱 *Number:* ${e164Format}\n🏙️ *City:* ${city || "N/A"}\n🌍 *Country:* ${countryCode}\n📡 *Carrier:* ${carrier} _(${numberType})_\n📧 *Email:* ${email || "N/A"}`;
	return sendMessageWTyping(from, { text: message }, { quoted: msg });
};

export default () => ({
	cmd: ["true", "truecaller"],
	desc: "Look up a valid local or international phone number",
	usage: "true <080… | +234… | international number> | reply/tag a member",
	handler,
});
