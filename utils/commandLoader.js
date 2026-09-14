import fs from "fs";
import util from "util";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { checkRateLimit } from "../cache/redisCache.js";
import { getBotData } from "../db/botData.js";
import { getGroupData } from "../db/groupData.js";
import { getSafeSettings } from "../db/safePackData.js";
import { isSameGroupUser } from "./groupParticipants.js";
import { isConfiguredModerator } from "./moderatorAuthority.js";
import { contextForCommandSegment, extractMessageBody, parseCommandChain } from "./multiCommand.js";

const readdir = util.promisify(fs.readdir);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mainPath = path.join(__dirname, "../commands/");

let commandsPublic = {};
let commandsMembers = {};
let commandsAdmins = {};
let commandsOwners = {};

const findLoadedCommand = (command) => {
	if (commandsPublic[command]) return { handler: commandsPublic[command], tier: "public" };
	if (commandsMembers[command]) return { handler: commandsMembers[command], tier: "member" };
	if (commandsAdmins[command]) return { handler: commandsAdmins[command], tier: "admin" };
	if (commandsOwners[command]) return { handler: commandsOwners[command], tier: "owner" };
	return null;
};

const canRunTier = async ({ tier, from, msg, info, isModerator }) => {
	if (tier === "public") return true;
	if (tier === "member") return Boolean(info.isGroup || msg?.key?.fromMe);
	if (tier === "owner") return Boolean(info.isOwner || isModerator);
	if (tier !== "admin" || !info.isGroup) return false;
	if (info.isOwner || isModerator || info.isGroupAdmin) return true;
	try {
		const safe = await getSafeSettings(from);
		return (safe?.helperMembers || []).some((jid) =>
			isSameGroupUser(info.groupMetadata, info.senderJid, jid));
	} catch {
		return false;
	}
};

const commandAvailable = async ({ command, from, info }) => {
	const botData = await getBotData().catch(() => null);
	if ((botData?.disabledGlobally || []).includes(command)) return { ok: false, reason: "globally disabled" };
	if (!info.isGroup) return { ok: true };
	const groupData = await getGroupData(from).catch(() => null);
	if (groupData?.isBotOn === false && !(command.startsWith("group") || command.startsWith("dev"))) {
		return { ok: false, reason: "bot is disabled in this group" };
	}
	if ((groupData?.cmdBlocked || []).includes(command)) return { ok: false, reason: "blocked in this group" };
	return { ok: true };
};

const wrapCommandHandler = (originalHandler, registeredCommand) => async (sock, msg, from, args, info = {}) => {
	if (info.multiCommandChild) return originalHandler(sock, msg, from, args, info);
	const prefix = info.prefix || process.env.PREFIX || "$";
	const chain = parseCommandChain(extractMessageBody(msg), prefix, 6);
	if (chain.commands.length <= 1 || chain.commands[0]?.command !== String(info.command || registeredCommand).toLowerCase()) {
		return originalHandler(sock, msg, from, args, info);
	}

	const moderator = isConfiguredModerator(info.groupMetadata, [
		info.senderJid,
		msg?.key?.participant,
		msg?.key?.participantPn,
		msg?.key?.participantAlt,
	]);
	const reply = (text) => info.sendMessageWTyping?.(from, { text }, { quoted: msg });
	if (chain.truncated) await reply("⚡ Safety limit: Alpha will run the first 6 commands in this message.");

	let firstResult;
	for (let index = 0; index < chain.commands.length; index += 1) {
		const segment = chain.commands[index];
		const loaded = findLoadedCommand(segment.command);
		if (!loaded) {
			await reply(`❌ Unknown command in batch: *${prefix}${segment.command}*.`);
			continue;
		}
		if (index > 0) {
			const allowed = await canRunTier({ tier: loaded.tier, from, msg, info, isModerator: moderator });
			if (!allowed) {
				await reply(`🛡️ Skipped *${prefix}${segment.command}*: you do not have permission for that command.`);
				continue;
			}
			const availability = await commandAvailable({ command: segment.command, from, info });
			if (!availability.ok) {
				await reply(`🚫 Skipped *${prefix}${segment.command}*: ${availability.reason}.`);
				continue;
			}
			if (!info.isOwner && !moderator) {
				const rateAllowed = await checkRateLimit(info.senderJid, segment.command, 3);
				if (!rateAllowed) {
					await reply(`⏳ Skipped *${prefix}${segment.command}*: command cooldown reached.`);
					continue;
				}
			}
		}

		const childInfo = {
			...info,
			command: segment.command,
			evv: segment.evv,
			isModerator: moderator,
			multiCommandChild: true,
			multiCommandIndex: index,
			multiCommandCount: chain.commands.length,
			extendedMessageOriginal: contextForCommandSegment(segment, info.extendedMessageOriginal || {}),
		};
		try {
			const result = await loaded.handler(sock, msg, from, segment.args, childInfo);
			if (index === 0) firstResult = result;
			console.log(`[MULTI_COMMAND] ${index + 1}/${chain.commands.length} ${segment.command}`);
		} catch (error) {
			console.error(`[MULTI_COMMAND] ${segment.command} failed:`, error.message);
			await reply(`⚠️ *${prefix}${segment.command}* failed: ${error.message}`);
		}
	}
	return firstResult;
};

const loadCommands = async (dirPath, commandsObj, cmdDetails) => {
	const filenames = await readdir(dirPath);
	for (const file of filenames) {
		if (!file.endsWith(".js")) continue;
		try {
			const filePath = path.join(dirPath, file);
			const fileUrl = pathToFileURL(filePath).href;
			const module = await import(fileUrl);
			const commandFunc = module.default;
			if (!commandFunc || typeof commandFunc !== "function") {
				console.warn(`⚠️ Warning: ${file} does not export a function`);
				continue;
			}
			const cmd_info = commandFunc();
			if (!cmd_info) {
				console.warn(`⚠️ Warning: ${file} function returned null/undefined`);
				continue;
			}
			if (!cmd_info.cmd || !Array.isArray(cmd_info.cmd)) {
				console.warn(`⚠️ Warning: ${file} has invalid cmd array:`, cmd_info.cmd);
				continue;
			}
			if (!cmd_info.handler || typeof cmd_info.handler !== "function") {
				console.warn(`⚠️ Warning: ${file} has invalid handler`);
				continue;
			}
			cmdDetails.push({ cmd: cmd_info.cmd, desc: cmd_info.desc, usage: cmd_info.usage });
			for (const c of cmd_info.cmd) commandsObj[c] = wrapCommandHandler(cmd_info.handler, c);
		} catch (error) {
			console.error(`❌ Error loading ${file}:`, error.message);
		}
	}
};

const deleteFiles = async (dirPath, extensions) => {
	const filenames = await readdir(dirPath);
	filenames.forEach((file) => {
		if (extensions.some((ext) => file.endsWith(ext))) fs.unlinkSync(dirPath + file);
	});
};

const addCommands = async () => {
	console.log("📦 Loading commands...");
	await loadCommands(mainPath + "public/", commandsPublic, []);
	console.log(`✅ Loaded ${Object.keys(commandsPublic).length} public commands`);
	await loadCommands(mainPath + "group/members/", commandsMembers, []);
	console.log(`✅ Loaded ${Object.keys(commandsMembers).length} member commands`);
	await loadCommands(mainPath + "group/admins/", commandsAdmins, []);
	console.log(`✅ Loaded ${Object.keys(commandsAdmins).length} admin commands`);
	await loadCommands(mainPath + "owner/", commandsOwners, []);
	console.log(`✅ Loaded ${Object.keys(commandsOwners).length} owner commands`);
	await deleteFiles("./", [".webp", ".jpeg", ".jpg", ".mp3", ".mp4", ".png", ".gif"]);
	console.log("🎉 All commands loaded successfully!");
};

let commandsLoaded = false;
const commandsReadyPromise = addCommands().then(() => { commandsLoaded = true; });

const cmdToText = async () => {
	const adminCommands = [];
	const publicCommands = [];
	const groupCommands = [];
	const ownerCommands = [];
	const directCommands = [];
	await loadCommands(mainPath + "public/", {}, directCommands);
	await loadCommands(mainPath + "public/", {}, publicCommands);
	await loadCommands(mainPath + "group/members/", {}, groupCommands);
	await loadCommands(mainPath + "group/admins/", {}, adminCommands);
	await loadCommands(mainPath + "owner/", {}, ownerCommands);
	return { publicCommands, groupCommands, adminCommands, ownerCommands, directCommands };
};

export { commandsPublic, commandsMembers, commandsAdmins, commandsOwners, cmdToText, commandsReadyPromise, commandsLoaded };
