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

const ALPHA_TONES = new Set([
	"auto", "friendly", "funny", "professional", "gentle", "concise",
	"chill", "energetic", "witty", "mentor", "teacher", "developer",
	"storyteller", "direct", "polished",
]);
const ALPHA_PRONOUNS = new Set(["neutral", "he", "she", "they"]);
const ALPHA_REPLY_LENGTHS = new Set(["auto", "short", "balanced", "detailed"]);
const ALPHA_REPLY_FORMATS = new Set(["auto", "paragraphs", "bullets", "steps"]);
const ALPHA_EMOJI_LEVELS = new Set(["low", "normal", "high"]);
const ALPHA_EXPERTISE_LEVELS = new Set(["auto", "beginner", "intermediate", "expert"]);
const ALPHA_ANSWER_MODES = new Set(["auto", "direct", "coach", "tutor", "analyst", "developer", "creator"]);

const getMemberPreferences = async (jid) => {
	const data = await getMemberData(jid);
	const pref = data?.alphaPreferences || {};
	return {
		tone: ALPHA_TONES.has(pref.tone) ? pref.tone : "auto",
		pronouns: ALPHA_PRONOUNS.has(pref.pronouns) ? pref.pronouns : "neutral",
		voiceProfile: normalizeVoiceProfile(pref.voiceProfile),
		textStyle: normalizeTextStyle(pref.textStyle),
		replyLength: ALPHA_REPLY_LENGTHS.has(pref.replyLength) ? pref.replyLength : "auto",
		replyFormat: ALPHA_REPLY_FORMATS.has(pref.replyFormat) ? pref.replyFormat : "auto",
		emojiLevel: ALPHA_EMOJI_LEVELS.has(pref.emojiLevel) ? pref.emojiLevel : "normal",
		expertise: ALPHA_EXPERTISE_LEVELS.has(pref.expertise) ? pref.expertise : "auto",
		answerMode: ALPHA_ANSWER_MODES.has(pref.answerMode) ? pref.answerMode : "auto",
	};
};

const setMemberPreferences = async (jid, preferences = {}) => {
	const current = await getMemberPreferences(jid);
	const next = {
		tone: ALPHA_TONES.has(preferences.tone) ? preferences.tone : current.tone,
		pronouns: ALPHA_PRONOUNS.has(preferences.pronouns) ? preferences.pronouns : current.pronouns,
		voiceProfile: preferences.voiceProfile === undefined
			? current.voiceProfile
			: normalizeVoiceProfile(preferences.voiceProfile, current.voiceProfile),
		textStyle: preferences.textStyle === undefined
			? current.textStyle
			: normalizeTextStyle(preferences.textStyle, current.textStyle),
		replyLength: ALPHA_REPLY_LENGTHS.has(preferences.replyLength) ? preferences.replyLength : current.replyLength,
		replyFormat: ALPHA_REPLY_FORMATS.has(preferences.replyFormat) ? preferences.replyFormat : current.replyFormat,
		emojiLevel: ALPHA_EMOJI_LEVELS.has(preferences.emojiLevel) ? preferences.emojiLevel : current.emojiLevel,
		expertise: ALPHA_EXPERTISE_LEVELS.has(preferences.expertise) ? preferences.expertise : current.expertise,
		answerMode: ALPHA_ANSWER_MODES.has(preferences.answerMode) ? preferences.answerMode : current.answerMode,
	};
	await member.updateOne({ _id: jid }, { $set: { alphaPreferences: next } }, { upsert: true });
	return next;
};

export { createMembersData, getMemberData, getMemberPreferences, setMemberPreferences, member };
