import { group } from "../../../db/groupData.js";
import { getGroupAutomation, setGroupAutomationTime, setGroupAutomationToggle } from "../../../db/groupAutomation.js";
import { alphaPanel } from "../../../utils/alphaStyle.js";
import { getHumanEngagementRuntime } from "../../../utils/humanEngagement.js";
import { parseMinutesToken } from "../../../utils/humanEngagementPolicy.js";

const onOff = (value) => value === "on" ? true : value === "off" ? false : null;
const timeRx = /^([01]\d|2[0-3]):[0-5]\d$/;

const fmtAgo = (ts) => {
  if (!ts) return "not observed yet";
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};

const statusText = async (from) => {
  const [data, automation] = await Promise.all([group.findOne({ _id: from }), getGroupAutomation(from)]);
  const runtime = getHumanEngagementRuntime(from);
  return alphaPanel({
    icon: "🌚",
    title: "Human Mode",
    lines: [
      `Human engagement: *${data?.humanEngagementEnabled == null ? (data?.isChatBotOn ? "ON (chatbot default)" : "OFF") : data.humanEngagementEnabled ? "ON" : "OFF"}*`,
      `Vibe level: *${data?.humanEngagementLevel || "balanced"}*`,
      `Silence trigger: *${data?.humanSilenceMinutes || 75} min*`,
      `Daily Alpha limit: *${data?.humanDailyLimit || 3}*`,
      `Active conversation joins: *${data?.humanActiveJoinEnabled === false ? "OFF" : "ON"}*`,
      `Admin event reminder: *${data?.humanAdminReminderEnabled === false ? "OFF" : "ON"}* at *${data?.humanAdminReminderTime || "21:30"}*`,
      `Door schedule: *${automation.doorScheduleEnabled ? "ON" : "OFF"}* (${automation.doorOpenTime} → ${automation.doorCloseTime})`,
      `Last human activity: *${fmtAgo(runtime.lastHumanAt)}*`,
      `Alpha spoke today: *${runtime.dailyCount} time(s)*`,
    ],
    footer: "Human Mode is rate-limited, context-light and never keeps more than a tiny recent-message window in memory.",
  });
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
  const { command, sendMessageWTyping } = msgInfoObj;
  const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
  try {
    if (command === "doorauto") {
      const action = String(args[0] || "status").toLowerCase();
      const toggle = onOff(action);
      if (toggle !== null) {
        await setGroupAutomationToggle(from, "doorScheduleEnabled", toggle);
        return reply(`✅ Door schedule turned *${toggle ? "ON" : "OFF"}*.`);
      }
      if (action === "open") {
        const time = await setGroupAutomationTime(from, args[1], "doorOpenTime");
        return reply(`✅ Group-open time set to *${time}*.`);
      }
      if (action === "close") {
        const time = await setGroupAutomationTime(from, args[1], "doorCloseTime");
        return reply(`✅ Group-close time set to *${time}*.`);
      }
      return reply(await statusText(from));
    }

    if (command === "eventadmin") {
      const action = String(args[0] || "status").toLowerCase();
      const toggle = onOff(action);
      if (toggle !== null) {
        await group.updateOne({ _id: from }, { $set: { humanAdminReminderEnabled: toggle } });
        return reply(`✅ 9:30PM admin event reminder turned *${toggle ? "ON" : "OFF"}*.`);
      }
      if (action === "time") {
        const time = String(args[1] || "");
        if (!timeRx.test(time)) return reply("❌ Use 24-hour time, e.g. `eventadmin time 21:30`.");
        await group.updateOne({ _id: from }, { $set: { humanAdminReminderTime: time } });
        return reply(`✅ Admin event reminder time set to *${time}*.`);
      }
      return reply(await statusText(from));
    }

    const action = String(args[0] || "status").toLowerCase();
    const toggle = onOff(action);
    if (toggle !== null) {
      await group.updateOne({ _id: from }, { $set: { humanEngagementEnabled: toggle } });
      return reply(`✅ Human Mode turned *${toggle ? "ON" : "OFF"}*.`);
    }
    if (action === "level") {
      const level = String(args[1] || "").toLowerCase();
      if (!["chill", "balanced", "lively"].includes(level)) return reply("❌ Use `humanmode level chill`, `balanced`, or `lively`.");
      await group.updateOne({ _id: from }, { $set: { humanEngagementLevel: level } });
      return reply(`✅ Human Mode level set to *${level}*.`);
    }
    if (action === "silence") {
      const minutes = parseMinutesToken(args[1], 75);
      await group.updateOne({ _id: from }, { $set: { humanSilenceMinutes: minutes } });
      return reply(`✅ Alpha may revive the group after about *${minutes} minutes* of silence.`);
    }
    if (action === "limit") {
      const limit = Math.min(5, Math.max(1, Number(args[1]) || 3));
      await group.updateOne({ _id: from }, { $set: { humanDailyLimit: limit } });
      return reply(`✅ Human Mode daily message limit set to *${limit}*.`);
    }
    if (action === "active") {
      const value = onOff(String(args[1] || "").toLowerCase());
      if (value === null) return reply("❌ Use `humanmode active on` or `humanmode active off`.");
      await group.updateOne({ _id: from }, { $set: { humanActiveJoinEnabled: value } });
      return reply(`✅ Automatic conversation joining turned *${value ? "ON" : "OFF"}*.`);
    }
    if (action === "adminreminder") {
      const time = String(args[1] || "21:30");
      if (!timeRx.test(time)) return reply("❌ Use `humanmode adminreminder 21:30`.");
      await group.updateOne({ _id: from }, { $set: { humanAdminReminderEnabled: true, humanAdminReminderTime: time } });
      return reply(`✅ Admin event reminder set for *${time}*.`);
    }
    return reply(await statusText(from));
  } catch (error) {
    return reply(`❌ ${error.message}`);
  }
};

export default () => ({
  cmd: ["humanmode", "vibemode", "engage", "eventadmin", "doorauto"],
  desc: "Control Alpha’s human engagement, silence revival, admin event reminders and optional group door schedule",
  usage: "humanmode on | humanmode level lively | humanmode silence 75m | eventadmin on | doorauto on",
  handler,
});
