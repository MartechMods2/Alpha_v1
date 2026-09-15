import mdClient from "./client.js";
import { normalizeTextStyle, normalizeVoiceProfile } from "../utils/alphaPresentation.js";

const member = mdClient.db("MyBotDataDB").collection("Members");

const createMembersData = async (jid, name) => {
	try {
		let res = await member.findOne({ _id: jid });

		if (res == null) {
			await member.insertOne({
				_id: jid,
				username: name,
				isBlock: false,
				totalmsg: 0,
				texttotal: 0,
				imagetotal: 0,
				videototal: 0,
				stickertotal: 0,
				pdftotal: 0,
				dmLimit: 99999,
				warning: [],
			});
		} else {
			await member.updateOne(
				{ _id: jid },
				{
					$set: {
						username: name,
					},
				}
			);
		}
	} catch (err) {
		console.error("[membersDataDb error]", err.message);
	}
};

const getMemberData = async (jid) => {
	try {
		let res = await member.findOne({ _id: jid });
		if (res) return res;
		return -1;
	} catch (err) {
		console.error("[membersDataDb error]", err.message);
		return -1;
	}
};

const getMemberPreferences = async (jid) => {
	const data = await getMemberData(jid);
	return {
		tone: data?.alphaPreferences?.tone || "auto",
		pronouns: data?.alphaPreferences?.pronouns || "neutral",
		voiceProfile: normalizeVoiceProfile(data?.alphaPreferences?.voiceProfile),
		textStyle: normalizeTextStyle(data?.alphaPreferences?.textStyle),
	};
};

const setMemberPreferences = async (jid, preferences = {}) => {
	const allowedTones = new Set(["auto", "friendly", "funny", "professional", "gentle", "concise"]);
	const allowedPronouns = new Set(["neutral", "he", "she", "they"]);
	const current = await getMemberPreferences(jid);
	const next = {
		tone: allowedTones.has(preferences.tone) ? preferences.tone : current.tone,
		pronouns: allowedPronouns.has(preferences.pronouns) ? preferences.pronouns : current.pronouns,
		voiceProfile: preferences.voiceProfile === undefined
			? current.voiceProfile
			: normalizeVoiceProfile(preferences.voiceProfile, current.voiceProfile),
		textStyle: preferences.textStyle === undefined
			? current.textStyle
			: normalizeTextStyle(preferences.textStyle, current.textStyle),
	};
	await member.updateOne({ _id: jid }, { $set: { alphaPreferences: next } }, { upsert: true });
	return next;
};

export { createMembersData, getMemberData, getMemberPreferences, setMemberPreferences, member };
