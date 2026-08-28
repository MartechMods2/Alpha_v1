import { getGroupData } from "../../../db/groupData.js";
import { createSafeItem, getSafeSettings, listSafeAudit, listSafeItems, recordSafeAudit, updateSafeItem, updateSafeSettings } from "../../../db/safePackData.js";
import { cleanSafeText, parseClockWindow, parseSafeDuration } from "../../../utils/safePack.js";
import { extractPhoneNumber } from "../../../utils/lid.js";

const targetFrom = (context) => context?.mentionedJid?.[0] || context?.participant || "";
const bool = (value) => value === "on" ? true : value === "off" ? false : null;

const handler = async (sock, msg, from, args, info) => {
	const { command, senderJid, extendedMessageOriginal, groupMetadata, sendMessageWTyping } = info;
	const reply = (text, mentions = []) => sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	const target = targetFrom(extendedMessageOriginal);
	const settings = await getSafeSettings(from);
	try {
		if (command === "antiraid") {
			const value = bool(String(args[0] || "").toLowerCase());
			if (value === null) return reply(`🛡️ Anti-raid: *${settings.antiRaidEnabled ? "ON" : "OFF"}*\nRule: ${settings.antiRaidLimit} joins/${settings.antiRaidWindowSeconds}s\nResponse: lock and alert; never mass-remove.`);
			const limit = Math.min(25, Math.max(5, Number(args[1]) || 8)); const seconds = Math.min(300, Math.max(30, Number(args[2]) || 60));
			await updateSafeSettings(from, { antiRaidEnabled: value, antiRaidLimit: limit, antiRaidWindowSeconds: seconds });
			return reply(`✅ Anti-raid ${value ? `enabled (${limit} joins/${seconds}s → lockdown)` : "disabled"}.`);
		}
		if (command === "slowmode") {
			const raw = String(args[0] || "status").toLowerCase();
			if (raw === "off") { await updateSafeSettings(from, { slowModeSeconds: 0 }); return reply("✅ Slow mode disabled."); }
			if (raw === "status") return reply(`🐢 Slow mode: *${settings.slowModeSeconds ? `${settings.slowModeSeconds}s` : "OFF"}*`);
			const ms = parseSafeDuration(raw, { min: 5_000, max: 300_000 }); if (!ms) return reply("❌ Use `slowmode 5s` to `slowmode 5m`, or `slowmode off`.");
			await updateSafeSettings(from, { slowModeSeconds: Math.round(ms / 1000) }); return reply(`✅ Slow mode set to *${Math.round(ms / 1000)} seconds*.`);
		}
		if (command === "lockdown") {
			const ms = parseSafeDuration(args[0], { min: 60_000, max: 24 * 3_600_000 }); if (!ms) return reply("❌ Usage: `lockdown 10m` (maximum 24h).");
			await sock.groupSettingUpdate(from, "announcement"); await updateSafeSettings(from, { lockdownUntil: new Date(Date.now() + ms) });
			await recordSafeAudit({ groupJid: from, action: "lockdown", actorJid: senderJid, reason: args.slice(1).join(" ") }); return reply(`🔒 Group locked for *${args[0]}*.`);
		}
		if (command === "unlock") { await sock.groupSettingUpdate(from, "not_announcement"); await updateSafeSettings(from, { lockdownUntil: null }); return reply("🔓 Group reopened."); }
		if (command === "grouphours") {
			if (String(args[0]).toLowerCase() === "off") { await updateSafeSettings(from, { quietHours: null }); return reply("✅ Group quiet hours disabled."); }
			const window = parseClockWindow(args.length >= 2 ? `${args[0]}-${args[1]}` : args[0]); if (!window) return reply("❌ Usage: `grouphours 22:00 07:00` or `grouphours off`.");
			await updateSafeSettings(from, { quietHours: window }); return reply(`🌙 Group quiet hours set: *${window.start}–${window.end}*.`);
		}
		if (command === "warnexpiry") {
			const raw = String(args[0] || "status").toLowerCase(); if (raw === "off") { await updateSafeSettings(from, { warningExpiryDays: 0 }); return reply("✅ Warning expiry disabled."); }
			if (raw === "status") return reply(`⚠️ Warning expiry: *${settings.warningExpiryDays ? `${settings.warningExpiryDays} days` : "OFF"}*`);
			const days = Number(raw.replace(/d$/, "")); if (!Number.isInteger(days) || days < 1 || days > 365) return reply("❌ Usage: `warnexpiry 30d` or `warnexpiry off`.");
			await updateSafeSettings(from, { warningExpiryDays: days }); return reply(`✅ Warnings now expire after *${days} days*.`);
		}
		if (command === "appeals") {
			const rows = await listSafeItems(from, "warning-appeal", { status: "pending" }, 30); return reply(rows.length ? `⚖️ *Pending Appeals*\n\n${rows.map((x, i) => `${i + 1}. @${extractPhoneNumber(x.memberJid)} — ${x.text}`).join("\n")}` : "✅ No pending warning appeals.", rows.map((x) => x.memberJid));
		}
		if (command === "resolveappeal") {
			const rows = await listSafeItems(from, "warning-appeal", { status: "pending" }, 30); const item = rows[Number(args[0]) - 1]; const decision = String(args[1] || "").toLowerCase();
			if (!item || !["approve", "reject"].includes(decision)) return reply("❌ Usage: `resolveappeal <number> approve|reject [note]`.");
			await updateSafeItem(from, "warning-appeal", item._id, { status: decision === "approve" ? "approved" : "rejected", resolution: cleanSafeText(args.slice(2).join(" "), 300), reviewedBy: senderJid });
			return reply(`✅ Appeal ${decision}d.`);
		}
		if (command === "modlog") {
			const rows = await listSafeAudit(from, 30); return reply(rows.length ? `📚 *Moderation Log*\n\n${rows.map((x, i) => `${i + 1}. ${x.action}${x.targetJid ? ` — @${extractPhoneNumber(x.targetJid)}` : ""}${x.reason ? ` — ${x.reason}` : ""}`).join("\n")}` : "📚 No moderation cases recorded.", rows.map((x) => x.targetJid).filter(Boolean));
		}
		if (command === "modcase") {
			if (!target) return reply("❌ Tag or reply to a member: `modcase @member reason`."); const reason = cleanSafeText(args.filter((x) => !x.startsWith("@")).join(" "), 300) || "Admin note";
			await recordSafeAudit({ groupJid: from, action: "manual-case", actorJid: senderJid, targetJid: target, reason }); return reply(`✅ Moderation case recorded for @${extractPhoneNumber(target)}.`, [target]);
		}
		if (command === "wordfilter") {
			const action = String(args[0] || "status").toLowerCase();
			if (["on", "off"].includes(action)) { await updateSafeSettings(from, { wordFilterEnabled: action === "on" }); return reply(`✅ Word filter ${action.toUpperCase()}.`); }
			if (action === "add") { const phrase = cleanSafeText(args.slice(1).join(" "), 60).toLowerCase(); if (phrase.length < 2) return reply("❌ Add a phrase."); await updateSafeSettings(from, { blockedPhrases: [...new Set([...(settings.blockedPhrases || []), phrase])].slice(-100) }); return reply("✅ Phrase blocked."); }
			if (action === "remove") { const index = Number(args[1]) - 1; const phrases = [...(settings.blockedPhrases || [])]; if (!phrases[index]) return reply("❌ Phrase not found."); phrases.splice(index, 1); await updateSafeSettings(from, { blockedPhrases: phrases }); return reply("✅ Phrase removed."); }
			return reply(`🧹 Word filter: *${settings.wordFilterEnabled ? "ON" : "OFF"}*\n${(settings.blockedPhrases || []).map((x, i) => `${i + 1}. ${x}`).join("\n") || "No blocked phrases."}`);
		}
		if (["mentionlimit", "medialimit"].includes(command)) {
			const field = command === "mentionlimit" ? "mentionLimit" : "mediaLimit"; const raw = String(args[0] || "status").toLowerCase();
			if (raw === "off") { await updateSafeSettings(from, { [field]: 0 }); return reply(`✅ ${command} disabled.`); }
			if (raw === "status") return reply(`${command}: *${settings[field] || "OFF"}*`);
			const limit = Number(raw); if (!Number.isInteger(limit) || limit < 2 || limit > 20) return reply(`❌ Usage: \`${command} 2-20\` or \`${command} off\`.`);
			await updateSafeSettings(from, { [field]: limit }); return reply(`✅ ${command} set to *${limit}*.`);
		}
		if (command === "probation") {
			const raw = String(args[0] || "status").toLowerCase(); if (raw === "off") { await updateSafeSettings(from, { probationHours: 0 }); return reply("✅ Probation disabled."); }
			if (raw === "status") return reply(`🆕 New-member probation: *${settings.probationHours ? `${settings.probationHours}h` : "OFF"}*`);
			const hours = Number(raw.replace(/h$/, "")); if (!Number.isInteger(hours) || hours < 1 || hours > 168) return reply("❌ Usage: `probation 24h` or `probation off`.");
			await updateSafeSettings(from, { probationHours: hours }); return reply(`✅ New members have a *${hours}h* restricted probation.`);
		}
		if (["joinrequests", "approvejoin", "rejectjoin"].includes(command)) {
			const requests = await sock.groupRequestParticipantsList(from); if (command === "joinrequests") return reply(requests.length ? `👥 *Join Requests*\n\n${requests.slice(0, 30).map((x, i) => `${i + 1}. @${extractPhoneNumber(x.jid || x.id)}`).join("\n")}` : "✅ No pending join requests.");
			const item = requests[Number(args[0]) - 1]; const jid = item?.jid || item?.id; if (!jid) return reply(`❌ Use \`joinrequests\`, then \`${command} <number>\`.`);
			await sock.groupRequestParticipantsUpdate(from, [jid], command === "approvejoin" ? "approve" : "reject"); return reply("✅ Join request updated.");
		}
		if (command === "inactive") {
			const days = Math.min(365, Math.max(7, Number(String(args[0] || "30d").replace(/d$/, "")) || 30)); const cutoff = Date.now() - days * 86_400_000; const data = await getGroupData(from);
			const rows = (data?.members || []).filter((x) => !x.lastMessageAt || new Date(x.lastMessageAt).getTime() < cutoff).slice(0, 50); return reply(rows.length ? `💤 *Inactive for ${days}+ days*\n\n${rows.map((x, i) => `${i + 1}. @${extractPhoneNumber(x.id)} — ${x.count || 0} messages`).join("\n")}` : `✅ No inactive members found for ${days} days.`, rows.map((x) => x.id));
		}
		if (command === "roleperms") {
			const action = String(args[0] || "list").toLowerCase(); const helpers = settings.helperMembers || [];
			if (action === "list") return reply(helpers.length ? `🧰 *Bot Helpers*\n${helpers.map((x, i) => `${i + 1}. @${extractPhoneNumber(x)}`).join("\n")}\n\nHelpers may use safe admin commands, never owner commands.` : "🧰 No bot helpers configured.", helpers);
			if (!["add", "remove"].includes(action) || !target) return reply("❌ Usage: `roleperms add|remove @member`.");
			const next = action === "add" ? [...new Set([...helpers, target])].slice(-20) : helpers.filter((x) => x !== target); await updateSafeSettings(from, { helperMembers: next }); return reply(`✅ Helper ${action === "add" ? "added" : "removed"}.`);
		}
	} catch (error) { console.error("Safe moderation command failed:", error.message); return reply(`❌ ${error.message}`); }
};

export default () => ({
	cmd: ["antiraid", "slowmode", "lockdown", "unlock", "grouphours", "warnexpiry", "appeals", "resolveappeal", "modcase", "modlog", "wordfilter", "mentionlimit", "medialimit", "probation", "joinrequests", "approvejoin", "rejectjoin", "inactive", "roleperms"],
	desc: "Safe anti-raid, slow mode, lockdown, appeals, moderation cases and group protection",
	usage: "antiraid on | slowmode 30s | lockdown 10m | wordfilter add phrase | joinrequests",
	handler,
});
