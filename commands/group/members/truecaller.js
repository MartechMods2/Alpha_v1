import dotenv from "dotenv";
dotenv.config();
const TRUECALLER_ID = process.env.TRUECALLER_ID || "";
import truecallerjs from "truecallerjs";
import { extractPhoneNumber } from "../../../utils/lid.js";
import { lookupNumberHelp, normalizeLookupNumber } from "../../../utils/phoneNumber.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { prefix, sendMessageWTyping, extendedMessageOriginal } = msgInfoObj;

	if (!TRUECALLER_ID) return sendMessageWTyping(from, { text: "```Truecaller ID is Missing```" }, { quoted: msg });

	let rawNumber;
	if (extendedMessageOriginal?.participant?.length > 0) {
		// Use extractPhoneNumber for LID/PN compatibility
		rawNumber = extractPhoneNumber(extendedMessageOriginal.participant);
	} else if (extendedMessageOriginal?.mentionedJid?.length > 0) {
		rawNumber = extractPhoneNumber(extendedMessageOriginal.mentionedJid[0]);
	} else {
		rawNumber = args.join(" ").trim();
	}
	if (!rawNumber) return sendMessageWTyping(from, { text: `❌ Give a number, tag a member, or reply to their message.\n\n${lookupNumberHelp(prefix)}` }, { quoted: msg });
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
