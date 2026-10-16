import { featureJSON } from "../../utils/featureHttp.js";
import { safePackItems } from "../../db/safePackData.js";
import { isSameGroupUser } from "../../utils/groupParticipants.js";
import { validMembershipPayment } from "../../utils/membershipPayments.js";
import { randomUUID } from "node:crypto";
const handler = async (sock, msg, from, args, info) => {
  const reply = (text) =>
    info.sendMessageWTyping(from, { text }, { quoted: msg });
  if (info.isGroup)
    return reply(
      "For payment privacy, message Alpha directly: membership status <group-id>, or membership start <group-id> <email>.",
    );
  const action = args[0] || "status",
    target = args[1];
  if (action === "verify") {
    const order = await safePackItems.findOne({
      _id: target,
      type: "membership-order",
      memberJid: info.senderJid,
    });
    if (!order) return reply("No matching purchase belongs to this account.");
    if (order.status === "paid")
      return reply("This purchase has already been credited.");
    const key = process.env.ALPHA_PAYSTACK_SECRET_KEY;
    if (!key?.startsWith("sk_live_"))
      return reply("Live membership payments are not configured.");
    try {
      const x = await featureJSON(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(target)}`,
        { cache: false, headers: { Authorization: "Bearer " + key } },
      );
      if (!validMembershipPayment(x.data, order))
        return reply("Payment is not confirmed for this membership.");
      const expiresAt = new Date(Date.now() + 30 * 86400000);
      const result = await safePackItems.updateOne(
        { _id: order._id, status: "pending" },
        { $set: { status: "paid", expiresAt, updatedAt: new Date() } },
      );
      return reply(
        result.modifiedCount
          ? "Membership active for 30 days. Use membership status " +
              order.groupJid
          : "Purchase was already processed.",
      );
    } catch {
      return reply(
        "Verification is temporarily unavailable. No membership was granted. Retry later.",
      );
    }
  }
  if (!/^\d+-?\d*@g\.us$/.test(target || ""))
    return reply(
      "Use membership status <group-id> or membership start <group-id> <email>.",
    );
  let metadata;
  try {
    metadata = await sock.groupMetadata(target);
  } catch {
    return reply("This group is unavailable to Alpha.");
  }
  if (
    !(metadata.participants || []).some((p) =>
      isSameGroupUser(metadata, p.id, info.senderJid),
    )
  )
    return reply(
      "Only current members can buy or view membership for that group.",
    );
  if (action === "status") {
    const row = await safePackItems
      .find({
        type: "membership-order",
        groupJid: target,
        memberJid: info.senderJid,
        status: "paid",
        expiresAt: { $gt: new Date() },
      })
      .sort({ expiresAt: -1 })
      .limit(1)
      .next();
    return reply(
      row
        ? "✦ Premium member • expires " + row.expiresAt.toISOString()
        : "No active paid group membership.",
    );
  }
  if (action !== "start") return reply("Actions: status, start, verify.");
  const key = process.env.ALPHA_PAYSTACK_SECRET_KEY,
    email = args[2];
  if (!key?.startsWith("sk_live_"))
    return reply("Live membership payments are not configured by the owner.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ""))
    return reply(
      "Provide your receipt email in this private chat. It will be sent to Paystack.",
    );
  const amountKobo = Math.round(
    Number(process.env.ALPHA_MEMBERSHIP_PRICE_NGN || 2000) * 100,
  );
  if (!Number.isSafeInteger(amountKobo) || amountKobo < 10000)
    return reply("Owner must configure a valid membership price.");
  const id = "alpha-" + randomUUID();
  await safePackItems.insertOne({
    _id: id,
    type: "membership-order",
    memberJid: info.senderJid,
    groupJid: target,
    status: "pending",
    amountKobo,
    createdAt: new Date(),
  });
  try {
    const x = await featureJSON(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountKobo,
          currency: "NGN",
          reference: id,
          metadata: {
            alpha_member: info.senderJid,
            alpha_group: target,
            alpha_product: "group-membership",
          },
        }),
      },
    );
    if (
      !x.status ||
      !/^https:\/\/checkout\.paystack\.com\//.test(
        x.data?.authorization_url || "",
      )
    )
      throw Error();
    return reply(
      `30-day group membership • NGN ${amountKobo / 100}\n${x.data.authorization_url}\n\nAfter payment: membership verify ${id}\nNo automatic renewal. Membership records do not change WhatsApp admin privileges.`,
    );
  } catch {
    return reply("Checkout could not open. No payment was collected by Alpha.");
  }
};
export default () => ({
  cmd: ["membership"],
  desc: "Private Paystack checkout and strictly verified 30-day group membership records",
  usage:
    "membership status <group-id> | membership start <group-id> <email> | membership verify <reference>",
  handler,
});
