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
	const { command, prefix, sendMessageWTyping, extendedMessageOriginal, groupMetadata } = msgInfoObj;
	if (command === "truestatus") return sendMessageWTyping(from, { text: TRUECALLER_ID
		? `📱 *Truecaller Health*\nCredential: CONFIGURED\nDefault country: ${process.env.TRUECALLER_DEFAULT_COUNTRY || "NG"}\n\nA configured credential does not guarantee that every valid number has a public Truecaller record.`
		: "📱 *Truecaller Health*\nCredential: MISSING\nAdd TRUECALLER_ID through the protected host environment." }, { quoted: msg });

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
	if (!data?.phones?.[0]) return sendMessageWTyping(from, { text: `ℹ️ *No accessible Truecaller record*\n\nThe number format was accepted:\n• International: ${normalized.e164}\n• Country: ${normalized.countryCode}\n\nTruecaller returned no public/community record for it. This does not mean the number is invalid. Try ${prefix}truestatus to check the integration; tagged members may also be looked up by typing their number directly.` }, { quoted: msg });

	const name = response.getName();
	const { e164Format, numberType, countryCode, carrier, type } = data.phones[0];
	const { city } = response.getAddresses()[0] || {};
	const email = response.getEmailId();

	const message = `🔍 *Truecaller Result*\n\n👤 *Name:* ${name}\n📱 *Number:* ${e164Format}\n🏙️ *City:* ${city || "N/A"}\n🌍 *Country:* ${countryCode}\n📡 *Carrier:* ${carrier} _(${numberType})_\n📧 *Email:* ${email || "N/A"}`;
	return sendMessageWTyping(from, { text: message }, { quoted: msg });
};

export default () => ({
	cmd: ["true", "truecaller", "truestatus"],
	desc: "Look up a valid local or international phone number",
	usage: "true <080… | +234… | international number> | reply/tag a member",
	handler,
});
