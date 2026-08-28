import { getSock } from "../core/socketRef.js";
import { claimSafeDelivery, releaseSafeDelivery, updateSafeItem } from "../db/safePackData.js";
import { safePackSettings, safePackItems } from "../db/safePackData.js";
import messageQueue from "../queue/messageQueue.js";
import { dateKey, isWithinQuietHours } from "./safePack.js";
import { createEncryptedBackup, getBackupStatus } from "./backupManager.js";

const advance = (date, repeat) => { const next = new Date(date); if (repeat === "daily") next.setDate(next.getDate() + 1); else if (repeat === "weekly") next.setDate(next.getDate() + 7); return next; };

const deliverScheduled = async (sock, item) => {
	const payload = item.payload || {}; if (new Date(payload.nextRun).getTime() > Date.now()) return;
	const claimKey = `${item.type}:${item._id}:${new Date(payload.nextRun).toISOString()}`;
	if (!await claimSafeDelivery(claimKey)) return;
	const content = item.type === "schedulepoll" ? { poll: { name: payload.question, values: payload.options, selectableCount: 1 } } : { text: item.text };
	try { await messageQueue.enqueue(item.groupJid, () => sock.sendMessage(item.groupJid, content), 2); } catch (error) { await releaseSafeDelivery(claimKey); throw error; }
	if (["daily", "weekly"].includes(payload.repeat)) await updateSafeItem(item.groupJid, item.type, item._id, { payload: { ...payload, nextRun: advance(payload.nextRun, payload.repeat) }, lastRun: new Date() });
	else await updateSafeItem(item.groupJid, item.type, item._id, { status: "sent", lastRun: new Date() });
};

export const checkSafePackSchedules = async () => {
	const sock = getSock(); if (!sock?.user) return;
	const due = await safePackItems.find({ type: { $in: ["schedulepost", "schedulepoll", "personal-reminder"] }, status: "active", "payload.nextRun": { $lte: new Date() } }).limit(20).toArray();
	for (const item of due) { try { if (item.type === "personal-reminder") { const claimKey=`reminder:${item._id}:${new Date(item.payload.nextRun).toISOString()}`; if(!await claimSafeDelivery(claimKey))continue; try{await messageQueue.enqueue(item.groupJid, () => sock.sendMessage(item.groupJid, { text: `⏰ @${item.memberJid.split("@")[0]} — ${item.text}`, mentions: [item.memberJid] }), 2);}catch(error){await releaseSafeDelivery(claimKey);throw error;} await updateSafeItem(item.groupJid, item.type, item._id, { status: "sent", lastRun: new Date() }); } else await deliverScheduled(sock, item); } catch (error) { console.warn("Safe schedule failed:", error.message); } }
	const settingsRows = await safePackSettings.find({ $or: [{ lockdownUntil: { $lte: new Date(), $ne: null } }, { quietHours: { $ne: null } }] }).limit(100).toArray();
	for (const settings of settingsRows) {
		try {
			if (settings.lockdownUntil && new Date(settings.lockdownUntil) <= new Date()) { const quiet = settings.quietHours && isWithinQuietHours(settings.quietHours); if (!quiet) await sock.groupSettingUpdate(settings._id, "not_announcement"); await safePackSettings.updateOne({ _id: settings._id }, { $set: { lockdownUntil: null } }); continue; }
			if (settings.quietHours) { const quiet = isWithinQuietHours(settings.quietHours); const state = quiet ? "quiet" : "open"; if (!settings.lastQuietState) { if (quiet) await sock.groupSettingUpdate(settings._id, "announcement"); await safePackSettings.updateOne({ _id: settings._id }, { $set: { lastQuietState: state, lastQuietTransitionAt: new Date() } }); } else if (settings.lastQuietState !== state) { await sock.groupSettingUpdate(settings._id, quiet ? "announcement" : "not_announcement"); await safePackSettings.updateOne({ _id: settings._id }, { $set: { lastQuietState: state, lastQuietTransitionAt: new Date() } }); } }
		} catch (error) { console.warn("Quiet-hours transition failed:", error.message); }
	}
	const now = new Date(); const weekday = new Intl.DateTimeFormat("en-US", { timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos", weekday: "long" }).format(now); const clock = new Intl.DateTimeFormat("en-GB", { timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false }).format(now); const today=dateKey(now);
	const weeklySettings=await safePackSettings.find({$or:[{gameNightEnabled:true},{quietHours:{$ne:null}}]}).limit(100).toArray();
	for(const settings of weeklySettings){if(settings.gameNightEnabled&&String(settings.gameNightDay).toLowerCase()===weekday.toLowerCase()&&settings.gameNightTime===clock){const claim=`gamenight:${settings._id}:${today}`;if(await claimSafeDelivery(claim,14))await messageQueue.enqueue(settings._id,()=>sock.sendMessage(settings._id,{text:"🎮 *Alpha Game Night is open!*\n\nTry `arcadehelp`, `ttt @member`, `connect4 @member`, `familyfeud`, `quiz`, or `tournament`. One game at a time keeps the group fun without flooding."}),2).catch(()=>releaseSafeDelivery(claim));}}
	const recurring=await safePackItems.find({type:"recurring-event",status:"active","payload.day":{$regex:`^${weekday}$`,$options:"i"},"payload.time":clock}).limit(50).toArray();for(const item of recurring){const claim=`eventrepeat:${item._id}:${today}`;if(await claimSafeDelivery(claim,14))await messageQueue.enqueue(item.groupJid,()=>sock.sendMessage(item.groupJid,{text:`📅 *Recurring Event*\n\n${item.text}`}),2).catch(()=>releaseSafeDelivery(claim));}
	if(weekday==="Monday"&&clock==="08:00"){const duties=await safePackItems.find({type:"duty-rota",status:"active"}).limit(100).toArray();for(const item of duties){const members=item.payload?.members||[];if(!members.length)continue;const claim=`duty:${item._id}:${today}`;if(!await claimSafeDelivery(claim,14))continue;const index=Number(item.payload.index||0)%members.length;const member=members[index];await messageQueue.enqueue(item.groupJid,()=>sock.sendMessage(item.groupJid,{text:`🔄 *Weekly Duty*\n@${member.split("@")[0]} — ${item.text}`,mentions:[member]}),2).catch(()=>releaseSafeDelivery(claim));await updateSafeItem(item.groupJid,item.type,item._id,{payload:{...item.payload,index:(index+1)%members.length}});}}
	if(String(process.env.AUTO_BACKUP_ENABLED||"false").toLowerCase()==="true"){const status=await getBackupStatus();const hours=Math.min(168,Math.max(6,Number(process.env.BACKUP_INTERVAL_HOURS)||24));if(!status.latest?.createdAt||Date.now()-new Date(status.latest.createdAt).getTime()>=hours*3_600_000)await createEncryptedBackup().catch((e)=>console.warn("Automatic backup failed:",e.message));}
};

let timer = null;
export const startSafePackScheduler = () => { if (timer) return; timer = setInterval(() => checkSafePackSchedules().catch((e) => console.warn("Safe scheduler:", e.message)), 30_000); timer.unref?.(); checkSafePackSchedules().catch(() => {}); console.log("[SAFE PACK] Scheduler started"); };
