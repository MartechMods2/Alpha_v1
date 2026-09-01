import { createHash } from "node:crypto";

export const SAFE_PACK_COMMANDS = Object.freeze([
	"antiraid", "slowmode", "lockdown", "unlock", "grouphours", "warnexpiry", "appeal", "appeals", "resolveappeal", "modcase", "modlog", "wordfilter", "mentionlimit", "medialimit", "probation", "joinrequests", "approvejoin", "rejectjoin", "inactive", "roleperms",
	"schedulepost", "schedulepoll", "remindplus", "snooze", "reschedule", "eventrepeat", "taskassign", "dutyrotate", "attendancesession", "attendanceexport", "form", "formanswer", "formresults", "slots", "bookslot", "fileindex", "filesearch", "smartfaq", "botlang", "workflow",
	"ocr", "qr", "readqr", "img2pdf", "pdf2img", "pdfmerge", "pdfsplit", "pdfcompress", "fileinfo", "filescan", "transcribe", "voicesummary", "voicetranslate", "autocaption", "cleanmedia", "album", "actionstyle",
	"ttt", "tttmove", "connect4", "drop", "tournament", "quizbank", "familyfeud", "feudanswer", "season", "seasonhistory", "wallet", "dailycoins", "shop", "buy", "inventory", "giftcoins", "richlist", "gamenight",
	"aiproviders", "aibudget", "aiprivacy", "webfactcheck", "smartminutes", "modassist",
	"backup", "backupstatus", "restorecheck", "storagehealth", "webhookadmin", "queuestatus", "configexport", "privacydata", "errorstatus", "migrationstatus", "safepackhelp",
	"osinthelp", "osintstatus", "dns", "dig", "rdap", "whois", "iprdap", "ipwhois", "asn", "asnlookup", "ptr", "tls", "ssl", "headers", "webheaders", "emailsecurity", "emailsec", "ctsearch", "certsearch", "hashid",
]);

export const cleanSafeText = (value, limit = 500) => String(value || "")
	.replace(/[\u0000-\u001f]/g, " ")
	.replace(/\s+/g, " ")
	.trim()
	.slice(0, limit);

export const parseSafeDuration = (value, { min = 1_000, max = 30 * 86_400_000 } = {}) => {
	const match = String(value || "").trim().match(/^(\d+)(s|m|h|d|w)$/i);
	if (!match) return null;
	const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[match[2].toLowerCase()];
	const milliseconds = Number(match[1]) * unit;
	return milliseconds >= min && milliseconds <= max ? milliseconds : null;
};

export const dateKey = (date = new Date(), timeZone = process.env.BOT_TIMEZONE || "Africa/Lagos") => new Intl.DateTimeFormat("en-CA", {
	timeZone, year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

export const parseClockWindow = (value) => {
	const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/);
	return match ? { start: `${match[1]}:${match[2]}`, end: `${match[3]}:${match[4]}` } : null;
};

export const nextClockDate = (clock, timeZone = process.env.BOT_TIMEZONE || "Africa/Lagos", now = new Date()) => {
	if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock || "")) return null;
	const format = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
	const start = Math.floor(now.getTime() / 60_000) * 60_000 + 60_000;
	for (let offset = 0; offset <= 26 * 60; offset += 1) {
		const candidate = new Date(start + offset * 60_000);
		if (format.format(candidate) === clock) return candidate;
	}
	return null;
};

export const redactPii = (value) => String(value || "")
	.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
	.replace(/\b(?:\+?234|0)[789]\d{9}\b/g, "[phone]")
	.replace(/\b\d{10,16}\b/g, "[number]");

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

export const isWithinQuietHours = (window, date = new Date(), timeZone = process.env.BOT_TIMEZONE || "Africa/Lagos") => {
	if (!window?.start || !window?.end) return false;
	const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
	const now = Number(parts.find((p) => p.type === "hour")?.value || 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value || 0);
	const minute = (clock) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
	const start = minute(window.start); const end = minute(window.end);
	return start <= end ? now >= start && now < end : now >= start || now < end;
};
