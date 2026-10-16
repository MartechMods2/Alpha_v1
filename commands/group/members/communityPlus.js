import {
  safePackItems,
  createSafeItem,
  listSafeItems,
  updateSafeItem,
} from "../../../db/safePackData.js";
import { randomUUID } from "node:crypto";
const clean = (x) =>
  String(x || "")
    .replace(/[\r\n\\;,]/g, " ")
    .slice(0, 300);
const handler = async (sock, msg, from, args, info) => {
  const send = (p) => info.sendMessageWTyping(from, p, { quoted: msg }),
    reply = (text) => send({ text }),
    command = info.command,
    admin = info.isOwner || info.isGroupAdmin;
  if (!info.isGroup) return reply("Use this feature in your group.");
  if (command === "onboarding")
    return reply(
      "✦ WELCOME TO ALPHA\n\n1. Read the group rules: $rules\n2. Introduce yourself: your name, interests, and what you hope to learn.\n3. Save your display name: $nickname set <name>\n4. Explore commands: $featurefinder <interest>\n5. Subscribe to a topic: $topics join linux\n\nPlease avoid sharing phone numbers, passwords, or private documents.",
    );
  if (command === "topics") {
    const action = args[0] || "list",
      topic = String(args[1] || "").toLowerCase();
    if (!["list", "mine"].includes(action) && !/^[a-z0-9-]{1,30}$/.test(topic))
      return reply(
        "Use topics join|leave|notify <topic> [message]. Topics use letters, numbers and hyphens.",
      );
    const id = `topic:${from}:${info.senderJid}:${topic}`;
    if (action === "join") {
      await safePackItems.updateOne(
        { _id: id },
        {
          $set: {
            groupJid: from,
            type: "topic-follow",
            memberJid: info.senderJid,
            text: topic,
            status: "active",
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      return reply(
        "Subscribed to " + topic + ". Use topics leave " + topic + " to stop.",
      );
    }
    if (action === "leave") {
      await safePackItems.deleteOne({ _id: id });
      return reply("Topic subscription removed.");
    }
    if (action === "notify") {
      if (!admin) return reply("Only admins send topic notifications.");
      const members = await listSafeItems(
        from,
        "topic-follow",
        { text: topic, status: "active" },
        100,
      );
      const text = args.slice(2).join(" ").slice(0, 2000);
      if (!text) return reply("Include the message after the topic.");
      return send({
        text: `📌 ${topic}\n\n${text}`,
        mentions: [...new Set(members.map((x) => x.memberJid))],
      });
    }
    const rows = await listSafeItems(
      from,
      "topic-follow",
      action === "mine" ? { memberJid: info.senderJid } : {},
      100,
    );
    return reply(
      [...new Set(rows.map((x) => x.text))].join("\n") ||
        "No topic subscriptions yet.",
    );
  }
  if (command === "calendarics") {
    const [title, start, end] = args
      .join(" ")
      .split("|")
      .map((x) => x.trim());
    const a = new Date(start),
      b = new Date(end);
    if (
      !title ||
      !start ||
      !end ||
      !Number.isFinite(a.getTime()) ||
      !Number.isFinite(b.getTime()) ||
      b <= a
    )
      return reply(
        "Use calendarics Title | 2026-11-01T15:00:00+01:00 | 2026-11-01T16:00:00+01:00",
      );
    const stamp = (d) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
    const data = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Alpha//Community//EN",
      "BEGIN:VEVENT",
      "UID:" + randomUUID() + "@alpha",
      "DTSTAMP:" + stamp(new Date()),
      "DTSTART:" + stamp(a),
      "DTEND:" + stamp(b),
      "SUMMARY:" + clean(title),
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    return send({
      document: Buffer.from(data),
      mimetype: "text/calendar",
      fileName: "alpha-event.ics",
    });
  }
  if (command === "ledger") {
    const action = args[0] || "mine";
    if (action === "add") {
      if (!admin) return reply("Only admins create ledger entries.");
      const target = info.extendedMessageOriginal?.mentionedJid?.[0];
      const amount = Number(args.find((x) => /^\d+(\.\d{1,2})?$/.test(x)));
      if (
        !target ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 1000000
      )
        return reply("ledger add @member <NGN amount> <description>");
      const item = await createSafeItem({
        groupJid: from,
        type: "ledger",
        memberJid: target,
        text: args
          .filter((x) => !x.startsWith("@"))
          .join(" ")
          .slice(0, 150),
        payload: {
          amountKobo: Math.round(amount * 100),
          createdBy: info.senderJid,
        },
        status: "unpaid",
      });
      return reply(
        "Ledger entry created: " +
          item._id +
          ". This is a record only, not a payment.",
      );
    }
    if (action === "settle") {
      if (!admin) return reply("Only admins confirm repayment.");
      const entry = await safePackItems.findOne({
        _id: args[1],
        groupJid: from,
        type: "ledger",
      });
      if (!entry) return reply("Entry not found.");
      await updateSafeItem(from, "ledger", entry._id, { status: "paid" });
      return reply("Entry marked paid.");
    }
    const rows = await listSafeItems(
      from,
      "ledger",
      admin && action === "all" ? {} : { memberJid: info.senderJid },
      30,
    );
    return reply(
      rows
        .map(
          (x) =>
            `${x._id}\nNGN ${(x.payload.amountKobo / 100).toFixed(2)} • ${x.status}\n${x.text}`,
        )
        .join("\n\n") || "No entries.",
    );
  }
};
export default () => ({
  cmd: ["onboarding", "topics", "calendarics", "ledger"],
  desc: "New-member orientation, opt-in topic notifications, calendar invites and repayment records",
  usage:
    "topics join linux | calendarics Title | ISO start | ISO end | ledger mine",
  handler,
});
