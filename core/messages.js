import dotenv from "dotenv";
dotenv.config();

import messageQueue from "../queue/messageQueue.js";
import notifyOwner from "../notify/owner.js";
import { escapeHtml } from "../notify/telegram.js";
import { readFileEfficiently } from "../utils/file.js";
import { getGroupMeta, setGroupMeta, checkRateLimit } from "../cache/redisCache.js";

const prefix = process.env.PREFIX;
const moderatos = (process.env.MODERATORS || "")
	.split(",")
	.map((number) => number.replace(/[^0-9]/g, ""))
	.filter(Boolean);
import getGroupAdmins from "../utils/groupAdmins.js";
import { extractPhoneNumber, getPNFromLID } from "../utils/lid.js";
import {
	getBotIdentityJids,
	isJidGroupAdmin,
	isSameGroupUser,
} from "../utils/groupParticipants.js";
import { createMembersData, getMemberData, member } from "../db/members.js";
import { createGroupData, getGroupData, group } from "../db/groupData.js";
import {
	commandsPublic,
	commandsMembers,
	commandsAdmins,
	commandsOwners,
	commandsReadyPromise,
	commandsLoaded,
} from "../utils/commandLoader.js";
import { getBotData } from "../db/botData.js";
import { saveChatMessage } from "../utils/chatLogger.js";
import { getRankUp } from "../utils/ranks.js";
import { handleAutomodMessage } from "../utils/automod.js";
import {
	buildAlphaPrompt,
	canUseAlphaMention,
	isAlphaQuiet,
	normalizeAlphaSettings,
	stripBotMention,
	useAlphaQuota,
} from "../utils/alphaMention.js";
import { getMediaRuntimeConfig } from "../utils/mediaJobs.js";
import { isGroupStatusMentionMessage } from "../utils/groupSafety.js";
import { handleAdvancedAutomation } from "../utils/advancedAutomation.js";
import { handleSafeModerationMessage } from "../utils/safeModeration.js";
import { getSafeSettings } from "../db/safePackData.js";

// ── FOOLPROOF REWRITE FOR OWNER/BOT IDENTIFICATION ─────────────────
const cleanMyNum = (process.env.MY_NUMBER || "").split(",")[0].replace(/[^0-9]/g, "");
const cleanBotNum = (process.env.BOT_NUMBER || "").split(",")[0].replace(/[^0-9]/g, "");

const myNumber = [
	cleanMyNum + "@s.whatsapp.net",
	cleanMyNum + "@lid",
	// Add support for direct incoming string segments
	cleanMyNum
];

const botNumber = [
	cleanBotNum + "@s.whatsapp.net",
	cleanBotNum + "@lid",
	cleanBotNum
];
// ─────────────────────────────────────────────────────────────────

const tagStickerCooldowns = new Map();
const ALPHA_MENTION_COOLDOWN_MS = 20_000;

// Cached tag sticker - loaded once at startup
let _tagStickerBuffer = null;
const getTagSticker = async () => {
	if (!_tagStickerBuffer) {
		_tagStickerBuffer = await readFileEfficiently("./media/tag.webp");
	}
	return _tagStickerBuffer;
};

const getCommand = async (sock, msg, cache) => {
	if (!commandsLoaded) await commandsReadyPromise;
	const startTime = process.hrtime();

	try {
		if (!sock || !sock.user) return;
		const messageKeys = Object.keys(msg.message);
		if (messageKeys.length === 0) return;
		if (msg.key.fromMe && !msg.key.remoteJid) return;

		// On first group send after idle, WA bundles senderKeyDistributionMessage + messageContextInfo
		// alongside the real content type. Pick the first known content type key directly.
		const _contentTypes = new Set([
			"conversation",
			"imageMessage",
			"videoMessage",
			"extendedTextMessage",
			"buttonsResponseMessage",
			"templateButtonReplyMessage",
			"listResponseMessage",
			"stickerMessage",
			"documentMessage",
			"audioMessage",
		]);

		const sendMessageWTyping = async (to, msgObj, messageOptions) => {
			try {
				if (!to || !msgObj) return;
				if (!sock || !sock.user) return;

				const mediaTypes = ["sticker", "image", "audio", "video", "document"];
				const messageType = Object.keys(msgObj)[0];
				const isGroupChat = to.endsWith("@g.us");

				if (mediaTypes.includes(messageType)) {
					if (typeof msgObj[messageType] === "string") {
						try {
							msgObj[messageType] = await readFileEfficiently(msgObj[messageType]);
						} catch (readErr) {
							console.error("❌ Error reading media file:", readErr.message);
							throw readErr;
						}
					}
				}

				const doSend = async () => {
					try {
						const sendOptions = {
							...messageOptions,
							mediaUploadTimeoutMs: isGroupChat ? 1000 * 60 * 10 : 1000 * 60 * 5,
						};

						await sock.sendMessage(to, msgObj, sendOptions);
					} catch (err) {
						console.error("❌ Error sending message:", err.message);
						throw err;
					}
				};

				if (isGroupChat) {
					const priority = mediaTypes.includes(messageType) ? 2 : 1;
					await messageQueue.enqueue(to, doSend, priority);
				} else {
					await messageQueue.enqueue(to, doSend, 0);
				}
				return;
			} catch (error) {
				console.error("❌ Error in sendMessageWTyping:", error.message);
				throw error;
			}
		};

		const from = msg.key.remoteJid;
		const content = JSON.stringify(msg.message);
		const type = messageKeys.find((k) => _contentTypes.has(k)) ?? messageKeys[0];

		const m = msg.message || {};

		const bodyMap = {
			conversation: m.conversation,
			imageMessage: m.imageMessage?.caption,
			videoMessage: m.videoMessage?.caption,
			extendedTextMessage: m.extendedTextMessage?.text,
			buttonsResponseMessage: m.buttonsResponseMessage?.selectedDisplayText,
			templateButtonReplyMessage: m.templateButtonReplyMessage?.selectedDisplayText,
			listResponseMessage: m.listResponseMessage?.title,
			documentMessage: m.documentMessage?.caption,
			audioMessage: m.audioMessage?.caption,
		};

		let body = bodyMap[type] ?? ""; // handles null + undefined
		body = String(body).trim();

		let types = [
			"conversation",
			"imageMessage",
			"videoMessage",
			"extendedTextMessage",
			"buttonsResponseMessage",
			"templateButtonReplyMessage",
			"listResponseMessage",
			"stickerMessage",
			"documentMessage",
			"audioMessage",
		];

		const extendedMessageOriginal =
			type === "extendedTextMessage" ? msg.message.extendedTextMessage.contextInfo : null;
		// console.log("extendedMessageOriginal:", JSON.stringify(extendedMessageOriginal, null, 2));

		if (type == "buttonsResponseMessage") {
			if (msg.message.buttonsResponseMessage.selectedButtonId == "eva")
				body = body.startsWith(prefix) ? body : prefix + body;
		} else if (type == "templateButtonReplyMessage") {
			body = body.startsWith(prefix) ? body : prefix + body;
		} else if (type == "listResponseMessage") {
			if (msg.message.listResponseMessage.singleSelectReply.selectedRowId == "eva")
				body = body.startsWith(prefix) ? body : prefix + body;
		}

		if (body[1] == " ") body = body[0] + body.slice(2);
		const isCmd = body.startsWith(prefix);
		const evv = body
			.trim()
			.split(/ +/)
			.slice(isCmd ? 1 : 0)
			.join(" ");
		const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
		const args = body.trim().split(/ +/).slice(1);
		//-------------------------------------------------------------------------------------------------------------//
		const isGroup = from.endsWith("@g.us");
		const senderJid = isGroup
			? msg.key.participant || msg.key.participantPn || msg.key.participantAlt
			: msg.key.remoteJid;
		let isOwner = myNumber.includes(senderJid) || msg.key.fromMe === true;
		if (!senderJid || !senderJid.includes("@")) return;

		const updateId = msg.key.fromMe ? botNumber[0] : senderJid;
		const updateName = msg.key.fromMe ? sock.user.name : msg.pushName;

		let groupMetadata = "";
		let groupData = "";
		if (isGroup) {
			groupMetadata = (await getGroupMeta(from)) || cache.get(from + ":groupMetadata");
			if (!groupMetadata) {
				try {
					groupMetadata = await Promise.race([
						sock.groupMetadata(from),
						new Promise((_, reject) =>
							setTimeout(() => reject(new Error("Group metadata fetch timeout")), 2000),
						),
					]);
					setGroupMeta(from, groupMetadata);
					cache.set(from + ":groupMetadata", groupMetadata, 10 * 60);
					await createGroupData(from, groupMetadata);
				} catch (error) {
					console.error("Group metadata fetch failed:", error.message);
					groupMetadata = { participants: [] };
				}
			}
		}
		const senderNumber = senderJid.includes(":") ? senderJid.split(":")[0] : senderJid.split("@")[0];
		if (senderJid !== updateId) createMembersData(senderJid, msg.pushName);
		let senderData = null;
		let groupDataFetched = null;
		try {
			[senderData, groupDataFetched] = await Promise.all([
				getMemberData(senderJid),
				isGroup ? getGroupData(from) : Promise.resolve(""),
			]);
		} catch {
			senderData = null;
			groupDataFetched = null;
		}
		if (isGroup) {
			groupData = groupDataFetched;
			if (!groupData && groupMetadata?.subject) {
				await createGroupData(from, groupMetadata);
				groupData = await getGroupData(from);
			}
		}
		if (senderData?.isBlock) return;

		// Refresh group roles before administrator commands so promotions and
		// demotions take effect immediately.
		if (isCmd && isGroup && commandsAdmins[command]) {
			try {
				const freshMetadata = await sock.groupMetadata(from);
				if (freshMetadata?.participants) {
					groupMetadata = freshMetadata;
					setGroupMeta(from, freshMetadata);
					cache.set(from + ":groupMetadata", freshMetadata, 10 * 60);
				}
			} catch (error) {
				console.warn("Could not refresh group metadata for admin command:", error.message);
			}
		}
		const groupAdmins = isGroup ? getGroupAdmins(groupMetadata.participants) : [];
		const senderIdentityJids = [senderJid, msg.key.participantPn, msg.key.participantAlt].filter(Boolean);
		const isGroupAdmin = isGroup ? isJidGroupAdmin(groupMetadata, senderIdentityJids) : false;
		const botJids = isGroup ? await getBotIdentityJids(sock, groupMetadata, botNumber) : [];
		const isBotAdmin = isGroup ? isJidGroupAdmin(groupMetadata, botJids) : false;
		if (isGroup && !isOwner) {
			isOwner = myNumber.some((ownerJid) => isSameGroupUser(groupMetadata, senderJid, ownerJid));
		}

		if (isGroup && !msg.key.fromMe) {
			try {
				const automodResult = await handleAutomodMessage({
					sock,
					msg,
					groupJid: from,
					senderJid,
					body,
					isCommand: isCmd,
					isOwner,
					isGroupAdmin,
					groupData,
					groupMetadata,
					botJids,
					isBotAdmin,
					isGroupStatusMention: isGroupStatusMentionMessage(msg),
					sendMessageWTyping,
				});
				if (automodResult.handled) return;
			} catch (error) {
				console.error("[automod error]", error.message);
			}
			try {
				const safeResult = await handleSafeModerationMessage({
					sock, msg, groupJid: from, senderJid, body, isCommand: isCmd,
					isOwner, isGroupAdmin, groupMetadata, botJids, isBotAdmin, sendMessageWTyping,
				});
				if (safeResult.handled) return;
			} catch (error) {
				console.error("[safe moderation error]", error.message);
			}
		}

		// Unknown service messages have now passed moderation and need no command processing.
		if (!types.includes(type)) return;
		if (!isCmd && type === "stickerMessage") return;

		// Determine media type field for counting
		const mediaTypeField =
			type === "conversation" || type === "extendedTextMessage"
				? "texttotal"
				: type === "imageMessage"
					? "imagetotal"
					: type === "videoMessage"
						? "videototal"
						: type === "stickerMessage"
							? "stickertotal"
							: type === "documentMessage"
								? "pdftotal"
								: null;

		if (mediaTypeField) {
			let updatedDoc = null;
			try {
				[updatedDoc] = await Promise.all([
					member.findOneAndUpdate(
						{ _id: updateId },
						{ $inc: { totalmsg: 1, [mediaTypeField]: 1 }, $set: { username: updateName } },
						{ returnDocument: "after" },
					),
					createMembersData(updateId, updateName),
				]);
			} catch (e) {
				console.error("[member update error]", e.message);
			}

			if (isGroup) {
				setImmediate(async () => {
					try {
						const snapId = updateId;
						const updated = await group.findOneAndUpdate(
							{ _id: from, "members.id": updateId },
							{
								$inc: { "members.$.count": 1, [`members.$.${mediaTypeField}`]: 1 },
								$set: { "members.$.name": updateName, "members.$.lastMessageAt": new Date() },
							},
							{ returnDocument: "after" },
						);

						if (!updated) {
							const newMember = {
								id: updateId,
								name: updateName,
								count: 1,
								texttotal: 0,
								imagetotal: 0,
								videototal: 0,
								stickertotal: 0,
								pdftotal: 0,
								lastMessageAt: new Date(),
							};
							newMember[mediaTypeField] = 1;
							await group.updateOne({ _id: from }, { $push: { members: newMember } });
						} else {
							// Check rank-up using per-group count
							const memberEntry = updated.members?.find((m) => m.id === snapId);
							const grpCount = memberEntry?.count || 0;
							const rankUp = getRankUp(grpCount);
							if (rankUp) {
								const grpCheck = await group.findOne({ _id: from }, { projection: { isRankNotifOn: 1 } });
								if (grpCheck?.isRankNotifOn) {
									const text = rankUp.congrats
										? `🎉 @${snapId.split("@")[0]} completed *${grpCount.toLocaleString()}* messages in this group! 💎`
										: `🎉 *Rank Up!*\n${rankUp.emoji} *${rankUp.name}*\n@${snapId.split("@")[0]} just hit *${grpCount.toLocaleString()}* messages in this group! 🚀`;
									await sendMessageWTyping(from, { text, mentions: [snapId] });
								}
							}
						}
						await group.updateOne({ _id: from }, { $inc: { totalMsgCount: 1 } });
					} catch (e) {
						console.error("[group member update error]", e.message);
					}
				});
			}
		}

		// Log text messages to chat history for gemini summarization
		// Skip: commands (prefix), eva triggers, bot's own messages
		const isEvaTrigger = body.trim().split(" ")[0].toLowerCase() === "eva";
		if (
			isGroup &&
			body &&
			!isCmd &&
			!isEvaTrigger &&
			!msg.key.fromMe &&
			(type === "conversation" || type === "extendedTextMessage")
		) {
			setImmediate(async () => {
				try {
					let replyTo = null;
					const ctx = msg.message?.extendedTextMessage?.contextInfo;
					if (ctx?.quotedMessage) {
						const qText =
							ctx.quotedMessage.conversation || ctx.quotedMessage.extendedTextMessage?.text || "";
						const qSender = ctx.participant || "";
						let qName = "";
						if (qSender) {
							const qMember = await getMemberData(qSender).catch(() => null);
							qName = qMember?.username || "";
						}
						replyTo = { sender: qSender, senderName: qName, text: qText };
					}
					let mentions = [];
					const mentionedJids = ctx?.mentionedJid || [];
					if (mentionedJids.length > 0) {
						mentions = await Promise.all(
							mentionedJids.map(async (jid) => {
								const memberData = await getMemberData(jid).catch(() => null);
								return { jid, name: memberData?.username || jid.split("@")[0] };
							}),
						);
					}
					await saveChatMessage(from, senderJid, updateName || msg.pushName || "", body, replyTo, mentions);
				} catch (e) {
					console.error("[chatLogger error]", e.message);
				}
			});
		}

		if (isGroup && type == "imageMessage" && groupData?.isAutoStickerOn) {
			if (msg.message.imageMessage.caption == "") {
				commandsPublic["sticker"](sock, msg, from, args, {
					senderJid,
					type,
					content,
					isGroup,
					sendMessageWTyping,
					evv,
				});
			}
		}

		//--------------------------------------------CHAT-BOT-FEATURE------------------------------------------------//
		const isChatBotOn = groupData ? groupData.isChatBotOn : false;
		const alphaContext =
			m.extendedTextMessage?.contextInfo ||
			m.imageMessage?.contextInfo ||
			m.videoMessage?.contextInfo ||
			m.documentMessage?.contextInfo ||
			m.audioMessage?.contextInfo ||
			{};
		const alphaMentioned = Array.isArray(alphaContext.mentionedJid)
			? alphaContext.mentionedJid
			: alphaContext.mentionedJid
				? [alphaContext.mentionedJid]
				: [];
		const botWasMentioned = alphaMentioned.some((jid) => isSameGroupUser(groupMetadata, jid, botJids));
		if (isGroup && isChatBotOn && !isCmd && botWasMentioned) {
			const settings = normalizeAlphaSettings(groupData);
			if (!canUseAlphaMention({
				settings,
				senderJid,
				isAdmin: isGroupAdmin,
				isOwner,
				matches: (left, right) => isSameGroupUser(groupMetadata, left, right),
			})) return;
			const cooldownKey = `${from}:${senderJid}`;
			const now = Date.now();
			if (settings.alphaMode === "off" || isAlphaQuiet(settings) || (tagStickerCooldowns.get(cooldownKey) || 0) > now) return;
			if (!useAlphaQuota(from, senderJid, settings.alphaDailyQuota)) return;
			tagStickerCooldowns.set(cooldownKey, now + ALPHA_MENTION_COOLDOWN_MS);
			const cleanMentionText = stripBotMention(body, alphaMentioned);
			if (settings.alphaMode === "sticker" || (settings.alphaMode === "mixed" && !cleanMentionText)) {
				if (settings.alphaStickerOn) {
					try {
						await sendMessageWTyping(from, { sticker: await getTagSticker() }, { quoted: msg });
					} catch (error) {
						console.error("Failed to send Alpha tag sticker:", error.message);
					}
				}
				return;
			}
			try {
				const pollText = cleanMentionText.replace(/^create\s+(?:a\s+)?poll\s*/i, "");
				if (/^create\s+(?:a\s+)?poll\b/i.test(cleanMentionText)) {
					const [question, ...options] = pollText.split("|").map((part) => part.trim()).filter(Boolean);
					if (question && options.length >= 2) {
						await sendMessageWTyping(from, { poll: { name: question.slice(0, 180), values: options.slice(0, 12).map((value) => value.slice(0, 100)), selectableCount: 1 } }, { quoted: msg });
						return;
					}
				}
				const reminderMatch = cleanMentionText.match(
					/^remind(?:\s+us)?(?:\s+(?:in|at))?\s+(\d+[mhdw]|\d{1,2}(?::\d{2})?(?:am|pm)|\d{1,2}:\d{2})\s+(?:to\s+)?(.+)$/i,
				);
				if (reminderMatch && commandsPublic.remind) {
					const reminderArgs = [reminderMatch[1], ...reminderMatch[2].trim().split(/\s+/)];
					await commandsPublic.remind(sock, msg, from, reminderArgs, {
						sendMessageWTyping,
						senderJid,
						isGroup,
						command: "remind",
						evv: reminderArgs.join(" "),
					});
					return;
				}
				const alphaPrompt = await buildAlphaPrompt({ sock, msg, body, mentionedJids: alphaMentioned, settings });
				const alphaCommand = /^summari[sz]e\b/i.test(cleanMentionText) ? "gemini" : "alpha";
				await commandsPublic["alpha"](sock, msg, from, alphaPrompt.split(/\s+/), {
					sendMessageWTyping,
					command: alphaCommand,
					updateName: updateName || senderData?.username,
					updateId,
					senderJid,
					groupMetadata,
					groupAdmins,
					isGroup,
					evv: alphaPrompt,
					isOwner,
					extendedMessageOriginal: alphaContext,
				});
			} catch (error) {
				console.error("Alpha mention failed:", error.message);
				await sendMessageWTyping(from, { text: `⚡ Alpha could not process that mention: ${error.message}` }, { quoted: msg });
			}
			return;
		}
		if (isGroup && isChatBotOn && (type == "conversation" || type == "extendedTextMessage")) {
			let isTaggedBot = false;
			let tagMessage = null;
			if (type == "extendedTextMessage") {
				let tagMessageSenderJID = msg.message?.extendedTextMessage?.contextInfo?.participant;
				isTaggedBot = isSameGroupUser(groupMetadata, tagMessageSenderJID, botJids);
				tagMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
			}
			const quotedText =
				tagMessage?.conversation ||
				tagMessage?.extendedTextMessage?.text ||
				"";
			const assistantName = getMediaRuntimeConfig().alphaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const isAlphaReply = isTaggedBot && new RegExp(
				`^(?:(?:⚡\\s*)?${assistantName}(?:⚡)?\\b|_\\*eva:\\*_?)`,
				"i",
			).test(quotedText.trim());
			if (body.split(" ")[0].toLowerCase() == "eva" || isAlphaReply) {
				const settings = normalizeAlphaSettings(groupData);
				if (!canUseAlphaMention({
					settings,
					senderJid,
					isAdmin: isGroupAdmin,
					isOwner,
					matches: (left, right) => isSameGroupUser(groupMetadata, left, right),
				})) return;
				commandsPublic["eva"](sock, msg, from, args, {
					sendMessageWTyping,
					command,
					updateName:
						updateName == "" || updateName == null || updateName == undefined
							? senderData?.username
							: updateName,
					updateId,
					senderJid,
					groupMetadata,
					groupAdmins,
					isGroup,
					evv,
					isOwner,
				});
				notifyOwner(
					sock,
					`🤖 <b>Command Used</b>\n` +
						`━━━━━━━━━━━━━━\n` +
						`📌 <b>Command:</b> <code>chat</code>\n` +
						`👤 <b>User:</b> ${escapeHtml(msg.pushName)}\n` +
						`📱 <b>ID:</b> <code>${escapeHtml(senderJid)}</code>\n` +
						`💬 <b>In:</b> ${escapeHtml(groupMetadata.subject)}`,
					msg,
				);
			}
		}
		if (!isCmd && !isEvaTrigger && isGroup && (type === "conversation" || type === "extendedTextMessage")) {
			try {
				const automationResult = await handleAdvancedAutomation({
					msg,
					groupJid: from,
					senderJid,
					senderName: updateName || senderData?.username,
					body,
					isGroup,
					isCommand: isCmd,
					isFromBot: Boolean(msg.key.fromMe),
					sendMessageWTyping,
				});
				if (automationResult.handled) return;
			} catch (error) {
				console.error("[advanced automation error]", error.message);
			}
		}
		//---------------------------------------------------NO-CMD----------------------------------------------------//
		if (!isCmd) return;
		//-------------------------------------------------------------------------------------------------------------//
		// Keep command bursts from turning into high-volume automated sends.
		// Owners are exempt so recovery/admin commands remain available.
		if (!isOwner) {
			const allowed = await checkRateLimit(senderJid, command, 3);
			if (!allowed) {
				console.log("Rate limit exceeded for", senderJid, "command:", command);
				return;
			}
		}
		sock.readMessages([msg.key]).catch(() => {});

		const msgInfoObj = {
			prefix,
			type,
			content,
			evv,
			command,
			isGroup,
			senderJid,
			groupMetadata,
			groupAdmins,
			isGroupAdmin,
			botNumber,
			botJids,
			isBotAdmin,
			sendMessageWTyping,
			notifyOwner,
			updateName,
			updateId,
			isOwner,
			startTime,
			extendedMessageOriginal,
		};
		const displayFrom = senderJid.endsWith("@s.whatsapp.net")
			? extractPhoneNumber(senderJid)
			: extractPhoneNumber((await Promise.resolve(getPNFromLID(sock, senderJid))) || senderJid);
		console.log(
			"[COMMAND]",
			command,
			"[FROM]",
			displayFrom,
			"[name]",
			msg.pushName,
			"[IN]",
			isGroup ? groupMetadata.subject : "Directs",
		);
		notifyOwner(
			sock,
			`🤖 <b>Command Used</b>\n` +
				`━━━━━━━━━━━━━━\n` +
				`📌 <b>Command:</b> <code>${escapeHtml(command)}</code>\n` +
				`👤 <b>User:</b> ${escapeHtml(msg.pushName)}\n` +
				`📱 <b>ID:</b> <code>${escapeHtml(displayFrom)}</code>\n` +
				`💬 <b>In:</b> ${escapeHtml(isGroup ? groupMetadata.subject : "Direct Message")}`,
			msg,
		);
		if (command != "") {
			const botData = await getBotData();
			const globallyDisabled = botData?.disabledGlobally || [];
			if (globallyDisabled.includes(command)) {
				return sendMessageWTyping(from, { text: `🚫 This command is globally disabled.` }, { quoted: msg });
			}
		}
		if (isGroup) {
			let resBotOn = groupData ? await groupData.isBotOn : false;
			if (resBotOn == false && !(command.startsWith("group") || command.startsWith("dev"))) {
				return sendMessageWTyping(from, {
					text:
						"```By default, bot is turned off in this group.\nAsk the Owner to activate.\n\nUse ```" +
						prefix +
						"dev",
				});
			}
			let blockCommandsInDB = await groupData?.cmdBlocked;
			if (command != "") {
				if (blockCommandsInDB.includes(command)) {
					return sendMessageWTyping(from, { text: `Command blocked for this group.` }, { quoted: msg });
				}
			}
		}
		// Track command usage for admin dashboard
		const { pushActivity, cmdUsage } = await import("../notify/adminEvents.js");
		if (commandsPublic[command] || commandsMembers[command] || commandsAdmins[command] || commandsOwners[command]) {
			cmdUsage.set(command, (cmdUsage.get(command) || 0) + 1);
			pushActivity("command_used", {
				cmd: command,
				from: senderJid,
				name: msg.pushName || senderJid.split("@")[0],
				group: isGroup ? groupMetadata?.subject || "Group" : "DM",
			});
		}
		if (commandsPublic[command]) {
			const t0 = Date.now();
			const result = await commandsPublic[command](sock, msg, from, args, msgInfoObj);
			const t1 = Date.now();
			console.log(`[PROFILE] Command '${command}' (public) took ${t1 - t0}ms`);
			return result;
		} else if (commandsMembers[command]) {
			const t0 = Date.now();
			let result;
			if (isGroup || msg.key.fromMe) {
				result = await commandsMembers[command](sock, msg, from, args, msgInfoObj);
			} else {
				result = await sendMessageWTyping(
					from,
					{ text: "```❎ This command is only applicable in Groups!```" },
					{ quoted: msg },
				);
			}
			const t1 = Date.now();
			console.log(`[PROFILE] Command '${command}' (members) took ${t1 - t0}ms`);
			return result;
		} else if (commandsAdmins[command]) {
			const t0 = Date.now();
			let result;
			if (!isGroup) {
				result = await sendMessageWTyping(
					from,
					{ text: "```❎ This command is only applicable in Groups!```" },
					{ quoted: msg },
				);
			} else if (isGroupAdmin || moderatos.includes(senderNumber) || isOwner || (await getSafeSettings(from)).helperMembers?.some((jid) => isSameGroupUser(groupMetadata, senderJid, jid))) {
				result = await commandsAdmins[command](sock, msg, from, args, msgInfoObj);
			} else {
				result = await sendMessageWTyping(
					from,
					{ text: "```🤭 kya matlab tum admin nhi ho.```" },
					{ quoted: msg },
				);
			}
			const t1 = Date.now();
			console.log(`[PROFILE] Command '${command}' (admins) took ${t1 - t0}ms`);
			return result;
		} else if (commandsOwners[command]) {
			const t0 = Date.now();
			let result;
			if (moderatos.includes(senderNumber) || isOwner) {
				result = await commandsOwners[command](sock, msg, from, args, msgInfoObj);
			} else {
				result = await sendMessageWTyping(
					from,
					{ text: "```🤭 kya matlab tum mere owner nhi ho.```" },
					{ quoted: msg },
				);
			}
			const t1 = Date.now();
			console.log(`[PROFILE] Command '${command}' (owners) took ${t1 - t0}ms`);
			return result;
		} else {
			const allCmds = [
				...Object.keys(commandsPublic),
				...Object.keys(commandsMembers),
				...Object.keys(commandsAdmins),
				...Object.keys(commandsOwners),
			];
			const lev = (a, b) => {
				const dp = Array.from({ length: a.length + 1 }, (_, i) =>
					Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
				);
				for (let i = 1; i <= a.length; i++)
					for (let j = 1; j <= b.length; j++)
						dp[i][j] =
							a[i - 1] === b[j - 1]
								? dp[i - 1][j - 1]
								: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
				return dp[a.length][b.length];
			};
			let best = null,
				bestDist = Infinity;
			for (const c of allCmds) {
				const d = lev(command, c);
				if (d < bestDist) {
					bestDist = d;
					best = c;
				}
			}
			const threshold = Math.max(2, Math.floor(command.length / 2));
			if (best && bestDist <= threshold) {
				return sendMessageWTyping(
					from,
					{ text: `Did you mean *${prefix}${best}*?` },
					{ quoted: msg },
				);
			}
			return sendMessageWTyping(
				from,
				{ text: "```" + msg.pushName + " !!Use " + prefix + "help ```" },
				{ quoted: msg },
			);
		}
	} catch (error) {
		console.error("❌ Error processing message:", error.message);
		console.error("📍 Error stack:", error.stack);
		console.error(
			"📝 Message details:",
			JSON.stringify(
				{
					from: msg?.key?.remoteJid,
					id: msg?.key?.id,
					fromMe: msg?.key?.fromMe,
					messageType: Object.keys(msg?.message || {})[0],
				},
				null,
				2,
			),
		);
		if (sock?.user && msg?.key?.remoteJid) {
			setTimeout(() => {
				sock.sendMessage(
					msg.key.remoteJid,
					{
						text: "❌ Sorry, I encountered an error processing your message. Please try again.",
					},
					{ quoted: msg },
				).catch(() => {});
			}, 1000);
		}
	}
};

export default getCommand;
