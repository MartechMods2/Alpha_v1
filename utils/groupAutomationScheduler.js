import { getActionSettings, recordAction } from "../db/actionData.js";
import { claimAutomationDelivery, listEnabledGroupAutomations, pruneAutomationDeliveries, releaseAutomationDelivery } from "../db/groupAutomation.js";
import { group } from "../db/groupData.js";
import { getGroupTools } from "../db/groupTools.js";
import { getMemberData } from "../db/members.js";
import { getSock } from "../core/socketRef.js";
import messageQueue from "../queue/messageQueue.js";
import { FRIENDLY_ACTIONS, createActionStickerImage } from "./actionStudio.js";
import { daysBetweenDateKeys, localClock } from "./groupAutomationHelpers.js";
import { getBotIdentityJids, isSameGroupUser, participantJids } from "./groupParticipants.js";
import { runMediaJob } from "./mediaJobs.js";
import { imageBufferToSticker } from "./mediaStudio.js";
import { getSafeSettings } from "../db/safePackData.js";
import { dailyInsightFor, renderGroupTemplate } from "./groupTemplates.js";
import { checkSilentHumanEngagement } from "./humanEngagement.js";

const safeName = (value, jid) => String(value || jid?.split("@")[0] || "Member").replace(/[\r\n\t*_~`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 50);
const memberName = async (jid) => { const data = await getMemberData(jid).catch(() => null); return safeName(data && data !== -1 ? data.username : "", jid); };
const sendQueued = (sock, jid, content) => messageQueue.enqueue(jid, () => sock.sendMessage(jid, content), 2);
const groupName = async (sock, jid) => { try { const metadata = await sock.groupMetadata(jid); return safeName(metadata?.subject || "the group"); } catch { return "the group"; } };
const isAdmin = (participant) => participant?.admin === true || participant?.admin === "admin" || participant?.admin === "superadmin";

const sendMorning = async (sock, automation, clock) => {
  if (!automation.morningEnabled || clock.time !== (automation.morningTime || "08:00")) return;
  const delivery = { groupJid: automation._id, type: "morning", key: clock.dateKey };
  if (!await claimAutomationDelivery(delivery)) return;
  try { const name = await groupName(sock, automation._id); await sendQueued(sock, automation._id, { text: renderGroupTemplate("morning", { group: name, quote: dailyInsightFor(clock.dateKey) }) }); }
  catch (error) { await releaseAutomationDelivery(delivery); throw error; }
};

const sendNight = async (sock, automation, clock) => {
  if (!automation.nightEnabled || clock.time !== (automation.nightTime || "23:00")) return;
  const delivery = { groupJid: automation._id, type: "night", key: clock.dateKey };
  if (!await claimAutomationDelivery(delivery)) return;
  try { const name = await groupName(sock, automation._id); await sendQueued(sock, automation._id, { text: renderGroupTemplate("night", { group: name }) }); }
  catch (error) { await releaseAutomationDelivery(delivery); throw error; }
};

const sendBirthdays = async (sock, automation, tools, clock) => {
  if (!automation.birthdayEnabled) return;
  const birthdays = (tools.birthdays || []).filter((item) => Number(item.day) === clock.day && Number(item.month) === clock.month);
  if (!birthdays.length) return;
  const delivery = { groupJid: automation._id, type: "birthday", key: clock.dateKey };
  if (!await claimAutomationDelivery(delivery)) return;
  const mentions = birthdays.map((item) => item.memberJid).filter(Boolean);
  const names = birthdays.map((item) => `@${String(item.memberJid || "").split("@")[0] || safeName(item.name)}`);
  try { const name = await groupName(sock, automation._id); await sendQueued(sock, automation._id, { text: renderGroupTemplate("birthday", { user: names.join(", "), group: name }), mentions }); }
  catch (error) { await releaseAutomationDelivery(delivery); throw error; }
};

const sendEventAlerts = async (sock, automation, tools, clock) => {
  if (!automation.eventAlertsEnabled) return;
  for (const event of tools.events || []) {
    const eventKey = new Date(event.date).toISOString().slice(0, 10);
    const days = daysBetweenDateKeys(clock.dateKey, eventKey);
    if (![30, 7, 1, 0].includes(days)) continue;
    const delivery = { groupJid: automation._id, type: "event", key: `${event.id}:${clock.dateKey}:${days}` };
    if (!await claimAutomationDelivery(delivery)) continue;
    const when = days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`;
    try { const name = await groupName(sock, automation._id); await sendQueued(sock, automation._id, { text: renderGroupTemplate("event", { group: name, event: safeName(event.title), date: eventKey, when }) }); }
    catch (error) { await releaseAutomationDelivery(delivery); throw error; }
  }
};

const sendAdminEventReminder = async (sock, automation, tools, clock) => {
  if (!automation.eventAlertsEnabled) return;
  const groupData = await group.findOne({ _id: automation._id }, { projection: { humanAdminReminderEnabled: 1, humanAdminReminderTime: 1 } }).catch(() => null);
  if (groupData?.humanAdminReminderEnabled === false) return;
  const reminderTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(groupData?.humanAdminReminderTime || "") ? groupData.humanAdminReminderTime : "21:30";
  if (clock.time !== reminderTime) return;
  const todaysEvents = (tools.events || []).filter((event) => {
    try { return new Date(event.date).toISOString().slice(0, 10) === clock.dateKey; } catch { return false; }
  });
  if (!todaysEvents.length) return;
  const delivery = { groupJid: automation._id, type: "admin-event-reminder", key: clock.dateKey };
  if (!await claimAutomationDelivery(delivery)) return;
  try {
    const metadata = await sock.groupMetadata(automation._id);
    const botJids = await getBotIdentityJids(sock, metadata);
    const admins = [...new Set((metadata.participants || []).filter(isAdmin).flatMap(participantJids).filter(Boolean))]
      .filter((jid) => !botJids.some((botJid) => isSameGroupUser(metadata, jid, botJid)))
      .slice(0, 20);
    if (!admins.length) return;
    const tags = admins.map((jid) => `@${String(jid).split("@")[0].split(":")[0]}`).join(" ");
    const titles = todaysEvents.slice(0, 3).map((event) => safeName(event.title)).join(" • ");
    await sendQueued(sock, automation._id, { text: `👀 Admin check: ${tags}\nToday’s event: *${titles}*. Quick wrap-up / follow-up before the day ends?`, mentions: admins });
  } catch (error) { await releaseAutomationDelivery(delivery); throw error; }
};

const sendDoorSchedule = async (sock, automation, clock) => {
  if (!automation.doorScheduleEnabled) return;
  const target = clock.time === (automation.doorOpenTime || "08:00") ? "open" : clock.time === (automation.doorCloseTime || "00:00") ? "close" : "";
  if (!target) return;
  const delivery = { groupJid: automation._id, type: `door-${target}`, key: clock.dateKey };
  if (!await claimAutomationDelivery(delivery)) return;
  try {
    await sock.groupSettingUpdate(automation._id, target === "open" ? "not_announcement" : "announcement");
    const text = target === "open"
      ? ["Good morning, troublemakers. 🌚 Doors are open.", "DESIRE HUB IS OPEN. 🥂 Come and make noise.", "8AM. Doors open. Who’s first? 👀"][clock.day % 3]
      : ["House closed. 🌚 Go and behave outside.", "12AM. Doors closed. Same madness tomorrow. 😂", "That’s enough trouble for tonight. Goodnight, Hub. 🌚🥂"][clock.day % 3];
    await sendQueued(sock, automation._id, { text });
  } catch (error) { await releaseAutomationDelivery(delivery); console.warn(`[GROUP AUTOMATION] door ${target} failed:`, error.message); }
};

const sendDailyAction = async (sock, automation, clock) => {
  if (!automation.actionDailyEnabled) return;
  const metadata = await sock.groupMetadata(automation._id);
  const [settings, safeSettings, botJids] = await Promise.all([getActionSettings(automation._id), getSafeSettings(automation._id), getBotIdentityJids(sock, metadata)]);
  if (settings.mode === "off") return;
  const candidates = (metadata.participants || []).map((participant) => participantJids(participant)[0]).filter(Boolean).filter((jid) => !isSameGroupUser(metadata, jid, botJids)).filter((jid) => !(settings.optedOutMembers || []).some((blocked) => isSameGroupUser(metadata, jid, blocked)));
  if (candidates.length < 2) return;
  const delivery = { groupJid: automation._id, type: "daily-action", key: clock.dateKey };
  if (!await claimAutomationDelivery(delivery)) return;
  try {
    const actorIndex = Math.floor(Math.random() * candidates.length); let targetIndex = Math.floor(Math.random() * (candidates.length - 1)); if (targetIndex >= actorIndex) targetIndex += 1;
    const actorJid = candidates[actorIndex]; const targetJid = candidates[targetIndex]; const action = FRIENDLY_ACTIONS[Math.floor(Math.random() * FRIENDLY_ACTIONS.length)];
    const [actorName, targetName] = await Promise.all([memberName(actorJid), memberName(targetJid)]);
    const sticker = await runMediaJob({ feature: "daily-action", groupJid: automation._id, senderJid: `automation:${automation._id}`, retryable: false, task: async () => imageBufferToSticker(await createActionStickerImage({ action, actorName, targetName, style: safeSettings.actionStyle }), { pack: "Alpha Daily Action", author: "Martech", quality: 84 }) });
    await sendQueued(sock, automation._id, { sticker, mentions: [actorJid, targetJid] });
    await recordAction({ groupJid: automation._id, actorJid, actorName, targetJid, targetName, action });
  } catch (error) { await releaseAutomationDelivery(delivery); throw error; }
};

let lastPruneDay = "";
export const checkGroupAutomations = async (now = new Date()) => {
  const sock = getSock();
  if (!sock?.user) return;
  let automations;
  try { automations = await listEnabledGroupAutomations(); }
  catch (error) { console.error("[GROUP AUTOMATION] DB fetch failed:", error.message); return; }

  for (const automation of automations) {
    try {
      const clock = localClock(now, automation.timezone || process.env.BOT_TIMEZONE || "Africa/Lagos");
      await sendMorning(sock, automation, clock);
      await sendNight(sock, automation, clock);
      await sendDoorSchedule(sock, automation, clock);
      const needsTools = automation.birthdayEnabled || automation.eventAlertsEnabled;
      const tools = needsTools ? await getGroupTools(automation._id) : {};
      await sendAdminEventReminder(sock, automation, tools, clock);
      if (clock.time !== (automation.time || "08:00")) continue;
      await sendBirthdays(sock, automation, tools, clock);
      await sendEventAlerts(sock, automation, tools, clock);
      await sendDailyAction(sock, automation, clock);
    } catch (error) { console.error(`[GROUP AUTOMATION] ${automation._id} failed:`, error.message); }
  }

  await checkSilentHumanEngagement({ sock, now }).catch((error) => console.warn("[HUMAN ENGAGEMENT] silence check failed:", error.message));
  const utcDay = now.toISOString().slice(0, 10);
  if (utcDay !== lastPruneDay) {
    lastPruneDay = utcDay;
    pruneAutomationDeliveries(45).catch(() => {});
  }
};

let interval = null;
export const startGroupAutomationScheduler = () => {
  if (interval) return;
  interval = setInterval(() => checkGroupAutomations(), 30_000);
  interval.unref?.();
  checkGroupAutomations();
  console.log("[GROUP AUTOMATION] Scheduler started");
};
