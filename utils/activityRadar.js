import { mergeLiveGroupActivity } from "./groupActivity.js";
import { normalizeUserJid } from "./groupParticipants.js";
import { alphaPanel, safeDisplayName } from "./alphaStyle.js";

export const activityNotice =
  "Recorded messages in this group only. This cannot detect online status, readers or ghosting; missing history does not mean inactivity.";
const HOUR = 3600000;
export const parseRadarWindow = (args = []) => {
  if (!args.length) return 24;
  if (
    args.length !== 1 ||
    !/^(?:[1-9]|[1-9]\d|1[0-5]\d|16[0-8])h$/.test(args[0])
  )
    return null;
  return Number(args[0].slice(0, -1));
};
export const classifyActivity = (members, hours = 24, now = Date.now()) => {
  const recent = [],
    quiet = [],
    unknown = [];
  for (const member of members) {
    const time = member.lastMessageAt
      ? new Date(member.lastMessageAt).getTime()
      : NaN;
    if (!Number.isFinite(time) || time > now || !member.hasTrackedActivity)
      unknown.push(member);
    else if (now - time <= hours * HOUR) recent.push(member);
    else quiet.push(member);
  }
  quiet.sort((a, b) => new Date(a.lastMessageAt) - new Date(b.lastMessageAt));
  return { recent, quiet, unknown };
};

// Injection keeps command flow testable without a database or live WhatsApp socket.
export const createActivityHandler =
  (findGroup, mode) => async (_sock, msg, from, args, info) => {
    const reply = (text) =>
      info.sendMessageWTyping(from, { text }, { quoted: msg });
    if (!info.isGroup) return reply("Use this command inside a group.");
    // Deliberately stricter than helper-command access: named reports are admin/owner only.
    if (mode === "spy" && !info.isGroupAdmin && !info.isOwner)
      return reply("Only group admins or the bot owner can use $spy.");
    const hours = parseRadarWindow(args);
    if (hours === null)
      return reply(`Usage: $${mode} [1h–168h]. Example: $${mode} 24h`);
    let data;
    try {
      data = await findGroup({ _id: from }, { projection: { members: 1 } });
    } catch {
      return reply(
        "Activity data is temporarily unavailable. Try again later.",
      );
    }
    if (
      !Array.isArray(info.groupMetadata?.participants) ||
      !info.groupMetadata.participants.length
    )
      return reply("The current group roster is unavailable. Try again later.");
    const members = mergeLiveGroupActivity({
      participants: info.groupMetadata.participants,
      trackedMembers: data?.members || [],
      botJids: info.botJids || [],
    });
    const { recent, quiet, unknown } = classifyActivity(members, hours);
    let title, lines;
    if (mode === "spy") {
      title = "Activity Radar";
      lines = [
        `Window: ${hours}h · Members: ${members.length}`,
        `🟢 Messaged recently: ${recent.length}`,
        `🌙 Last recorded message older than ${hours}h: ${quiet.length}`,
        `❔ Unknown history: ${unknown.length}`,
        "Quiet corner (up to 10):",
        ...quiet
          .slice(0, 10)
          .map(
            (m, i) =>
              `${i + 1}. ${safeDisplayName(m.name, "")} · last message ${new Date(m.lastMessageAt).toISOString().slice(0, 16).replace("T", " ")} UTC`,
          ),
      ];
      if (!quiet.length)
        lines.push("No members with a known last message outside this window.");
    } else if (mode === "activitycard") {
      const self = members.find((m) =>
        m.aliases.includes(normalizeUserJid(info.senderJid)),
      );
      title = "Your Activity Card";
      if (!self)
        return reply(
          "Your membership could not be matched to the current roster. Try again later.",
        );
      const count = self.count;
      const badge =
        count >= 1000
          ? "🏆 Conversation legend"
          : count >= 100
            ? "🔥 Conversation spark"
            : count > 0
              ? "🌱 Growing voice"
              : "✨ Fresh page";
      lines = [
        badge,
        `Recorded messages: ${count}`,
        `💬 Text: ${self.texttotal} · 🎭 Stickers: ${self.stickertotal}`,
        `🖼️ Images: ${self.imagetotal} · 🎥 Videos: ${self.videototal}`,
        "Badges use recorded totals, not an all-time ranking.",
      ];
    } else {
      title = "Group Mood";
      const share = members.length
        ? Math.round((recent.length / members.length) * 100)
        : 0;
      lines = [
        share >= 60
          ? "🔥 Campfire conversations!"
          : share >= 25
            ? "☕ Cozy conversation corner."
            : "🌙 A quiet lounge today.",
        `${recent.length}/${members.length} members have a recorded message within ${hours}h (${share}%).`,
        `Unknown history: ${unknown.length}.`,
        "🎲 Icebreaker: What tiny win made your day better?",
      ];
    }
    return reply(
      alphaPanel({ icon: "📡", title, lines, footer: activityNotice }),
    );
  };
