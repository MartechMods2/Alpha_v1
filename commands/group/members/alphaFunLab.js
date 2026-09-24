import { createHash } from "node:crypto";
import { cleanFeatureText, dateKey, safeMemberName } from "../../../utils/featureSuite.js";
import { isCreatorBirthdayToday } from "../../../utils/creatorBirthday.js";

const COMMANDS = [
	"aurafarm", "auracard",
	"glitchcard",
	"buildquest",
	"techprophecy",
	"mysterydrop",
	"vibecode",
	"funlab",
];

const hashNumber = (value) =>
	Number.parseInt(createHash("sha256").update(String(value)).digest("hex").slice(0, 12), 16);

const pick = (items, seed, offset = 0) => items[(seed + offset) % items.length];
const clampScore = (value) => 70 + (Math.abs(value) % 31);

const ROLES = [
	"Bug Whisperer", "Midnight Builder", "Packet Poet", "Prototype Pilot",
	"Terminal Tactician", "Pixel Architect", "Cache Commander", "Version-Control Wizard",
];

const PERKS = [
	"turns vague ideas into working prototypes",
	"spots the tiny bug everybody else walked past",
	"ships first, polishes smart, learns fast",
	"can turn a chaotic group chat into a product idea",
	"somehow finds the one setting nobody checked",
	"survives deadline mode with suspiciously good energy",
];

const PATCHES = [
	"+15 focus when the Wi-Fi behaves",
	"+20 creativity after midnight",
	"+10 debugging instinct near impossible bugs",
	"+25 confidence after the first successful build",
	"+30 comeback energy after a failed deploy",
];

const QUESTS = [
	{ title: "Tiny Tool Sprint", task: "Build a tool that solves one annoying daily problem in under 30 lines or one simple screen.", constraint: "No login page. Start with the useful part." },
	{ title: "One-Button Product", task: "Design a mini product whose main job can be completed with one obvious button.", constraint: "Explain the value in one sentence." },
	{ title: "Offline First", task: "Sketch a useful app feature that still works when the internet disappears.", constraint: "Store only the minimum data needed." },
	{ title: "WhatsApp Utility", task: "Invent one bot command that would save a group at least five minutes every week.", constraint: "It must be useful without AI." },
	{ title: "Game Mechanic Lab", task: "Create one mobile-game mechanic that is fun in a 60-second session.", constraint: "No pay-to-win mechanic." },
	{ title: "Fix the Friction", task: "Pick a frustrating app flow and redesign it in three steps or fewer.", constraint: "Remove something instead of adding more screens." },
];

const PROPHECIES = [
	"Your next useful idea will arrive while you are fixing something completely unrelated.",
	"A tiny feature you almost ignore will become the thing people keep using.",
	"One stubborn bug will accidentally teach you a cleaner architecture.",
	"You will delete more code than you add—and the project will get better.",
	"A random group-chat complaint will become a surprisingly good product idea.",
	"Your strongest upgrade will be boring on paper: better defaults, fewer errors, faster recovery.",
];

const DROPS = [
	{ rarity: "LEGENDARY", item: "Golden Commit Badge", effect: "+25 shipping confidence" },
	{ rarity: "EPIC", item: "Midnight Debug Crown", effect: "+20 bug patience" },
	{ rarity: "RARE", item: "Zero-Drama Deploy Token", effect: "+15 recovery speed" },
	{ rarity: "EPIC", item: "Main Character Keyboard", effect: "+18 build aura" },
	{ rarity: "MYTHIC", item: "Infinite Tabs Relic", effect: "+30 controlled chaos" },
	{ rarity: "RARE", item: "Clean Console Charm", effect: "+12 debugging luck" },
];

const vibeCode = (input, name) => {
	const text = cleanFeatureText(input, 120) || "build something unforgettable";
	const safe = text.replace(/["\\]/g, "");
	return [
		"🧬 *VIBE CODE*",
		"",
		`user = "${name}"`,
		`mission = "${safe}"`,
		"aura = MAX",
		"fear = 0",
		"if (idea) ship();",
		"if (bug) debug();",
		"if (failure) upgrade();",
		"",
		"status: *CREATOR MODE ACTIVE* ⚡",
	].join("\n");
};

const auraCard = ({ senderJid, updateName, input, birthdayMode = false }) => {
	const name = safeMemberName(updateName, senderJid);
	const seed = hashNumber(`${dateKey()}|${senderJid}|aurafarm|${input}`);
	const theme = cleanFeatureText(input, 80);
	return [
		"🟣⚡ *AURA FARMING CARD*",
		"",
		`👤 *${name}*`,
		theme ? `🎯 Theme: *${theme}*` : "",
		`🧠 Creative Signal: *${clampScore(seed)}%*`,
		`💻 Builder Energy: *${clampScore(seed >> 2)}%*`,
		`🐛 Debug Instinct: *${clampScore(seed >> 4)}%*`,
		`🚀 Shipping Aura: *${clampScore(seed >> 6)}%*`,
		`🎭 Chaos Control: *${clampScore(seed >> 8)}%*`,
		"",
		`🏷️ Title: *${pick(ROLES, seed, 3)}*`,
		`✨ Passive Perk: ${pick(PERKS, seed, 7)}.`,
		`🔧 Daily Buff: ${pick(PATCHES, seed, 11)}.`,
		birthdayMode ? "🎂 Birthday Overclock: *CREATOR AURA x100*" : "",
		"",
		"_For fun only — not a real assessment._",
	].filter(Boolean).join("\n");
};

const glitchCard = ({ senderJid, updateName }) => {
	const name = safeMemberName(updateName, senderJid);
	const seed = hashNumber(`${dateKey()}|${senderJid}|glitchcard`);
	const hex = createHash("sha1").update(`${senderJid}|${dateKey()}`).digest("hex").slice(0, 8).toUpperCase();
	return [
		"🖥️ *ALPHA GLITCH CARD*",
		"",
		`ID: *${hex}*`,
		`Handle: *${name}*`,
		`Class: *${pick(ROLES, seed, 1)}*`,
		`System Mood: *${pick(["stable-ish", "overclocked", "quietly dangerous", "shipping", "debugging reality"], seed, 2)}*`,
		`Uptime: *${82 + (seed % 19)}%*`,
		`Special Move: *${pick(PERKS, seed, 9)}*`,
		"",
		"⚠️ Harmless simulation. No real device scan was performed.",
	].join("\n");
};

const buildQuest = ({ from }) => {
	const seed = hashNumber(`${dateKey()}|${from}|buildquest`);
	const quest = pick(QUESTS, seed);
	return [
		"🛠️⚡ *BUILD QUEST*",
		"",
		`🎯 *${quest.title}*`,
		quest.task,
		"",
		`🔒 Constraint: ${quest.constraint}`,
		"⏱️ Suggested sprint: *15 minutes*",
		"🏆 Win condition: produce one screenshot, sketch, snippet, or working mini-demo.",
		"",
		`Quest seed: *${String(seed).slice(-6)}*`,
	].join("\n");
};

const techProphecy = ({ senderJid, updateName }) => {
	const name = safeMemberName(updateName, senderJid);
	const seed = hashNumber(`${dateKey()}|${senderJid}|techprophecy`);
	return [
		"🔮💻 *TECH PROPHECY*",
		"",
		`*${name}*, ${pick(PROPHECIES, seed)}`,
		"",
		`Signal strength: *${75 + (seed % 26)}%*`,
		"_Purely fictional fun, not an actual prediction._",
	].join("\n");
};

const mysteryDrop = ({ senderJid, updateName }) => {
	const name = safeMemberName(updateName, senderJid);
	const seed = hashNumber(`${dateKey()}|${senderJid}|mysterydrop`);
	const drop = pick(DROPS, seed);
	return [
		"📦⚡ *TODAY'S MYSTERY DROP*",
		"",
		`👤 ${name}`,
		`💎 Rarity: *${drop.rarity}*`,
		`🎁 Item: *${drop.item}*`,
		`✨ Effect: ${drop.effect}`,
		"",
		"Your daily drop stays the same until the next bot-local day.",
		"_Virtual fun item only. No monetary value._",
	].join("\n");
};

const handler = async (_sock, msg, from, args, info) => {
	const { command, senderJid, updateName, isOwner, sendMessageWTyping } = info;
	const reply = (body) => sendMessageWTyping(from, { text: body }, { quoted: msg });
	const input = args.join(" ");

	switch (command) {
		case "aurafarm":
		case "auracard":
			return reply(auraCard({ senderJid, updateName: updateName || msg?.pushName, input, birthdayMode: Boolean(isOwner && isCreatorBirthdayToday()) }));
		case "glitchcard":
			return reply(glitchCard({ senderJid, updateName: updateName || msg?.pushName }));
		case "buildquest":
			return reply(buildQuest({ from }));
		case "techprophecy":
			return reply(techProphecy({ senderJid, updateName: updateName || msg?.pushName }));
		case "mysterydrop":
			return reply(mysteryDrop({ senderJid, updateName: updateName || msg?.pushName }));
		case "vibecode":
			return reply(vibeCode(input, safeMemberName(updateName || msg?.pushName, senderJid)));
		case "funlab":
			return reply([
				"🧪⚡ *ALPHA FUN LAB*",
				"",
				"`aurafarm [theme]` — daily aura card",
				"`glitchcard` — cyber-style profile card",
				"`buildquest` — practical mini build challenge",
				"`techprophecy` — fictional tech prophecy",
				"`mysterydrop` — daily virtual loot",
				"`vibecode <mission>` — turn a mission into creator pseudo-code",
				"",
				"These are lightweight local features and do not consume an AI-provider request.",
			].join("\n"));
	}
};

export default () => ({
	cmd: COMMANDS,
	desc: "Creator-style fun lab: aura cards, tech prophecies, build quests, glitch cards and daily drops",
	usage: "funlab | aurafarm [theme] | glitchcard | buildquest | techprophecy | mysterydrop | vibecode <mission>",
	handler,
});
