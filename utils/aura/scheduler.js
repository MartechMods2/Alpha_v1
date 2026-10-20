import { aura, auraStore } from "../../db/auraData.js";
import { getSock } from "../../core/socketRef.js";
import messageQueue from "../../queue/messageQueue.js";
import { scheduledSlot } from "./policy.js";
let timer,
  running = false;
export async function checkAuraSchedules(deps = {}) {
  const engine = deps.engine || aura,
    store = deps.store || auraStore,
    queue = deps.queue || messageQueue;
  const instant = deps.now || new Date();
  if (running) return;
  running = true;
  try {
    // A crashed or interrupted handler must not leave spendable Aura reserved forever.
    const stale = await store.find(
      "AuraCharges",
      { status: "reserved", expiresAt: { $lte: instant } },
      { expiresAt: 1 },
      50,
    );
    for (const row of stale) await engine.settle(row.actor, row._id, false);
    const pending = await store.find("AuraDuels", { state: "result" }, {}, 20);
    for (const row of pending)
      await engine
        .ranked(row.winner, row.loser, row.matchId, row._id)
        .catch(() => {});
    const sock = deps.sock || getSock();
    if (!sock?.user || !sock.alphaConnected) return;
    const slot = scheduledSlot(instant);
    if (!slot) return;
    const settings = await store.get("AuraSettings", "drops");
    const groups = (settings?.groups || [])
      .filter((x) => /^\d+(?:-\d+)?@g\.us$/.test(x))
      .slice(0, 20);
    if (!groups.length) return;
    const coupon = await engine.createDrop(slot, groups);
    if (coupon.status !== "open" || +new Date(coupon.expiresAt) <= +instant)
      return;
    for (const group of groups.filter((jid) => coupon.groups.includes(jid))) {
      const claimed = await store.transaction(async (tx) => {
        const row = await tx.get("AuraCoupons", coupon._id);
        if (row.status !== "open" || row.posted.includes(group)) return false;
        row.posted.push(group);
        await tx.put("AuraCoupons", row);
        return true;
      });
      if (!claimed) continue;
      await queue
        .enqueue(
          group,
          () =>
            sock.sendMessage(group, {
              text: `✨ *AURA DROP · 20,000 AURA*\n\nFirst valid claim wins globally.\nRedeem: $redeem ${coupon.code}\nExpires 30 minutes after creation. One scheduled win per member per Lagos day.\nAura has no cash value.`,
            }),
          2,
        )
        .catch(() =>
          console.warn(
            "[AURA] Drop delivery failed; not automatically reposted.",
          ),
        );
    }
  } catch {
    console.warn("[AURA] Scheduler unavailable; no unsafe fallback used.");
  } finally {
    running = false;
  }
}
export function startAuraScheduler() {
  if (timer) return;
  timer = setInterval(() => void checkAuraSchedules(), 60000);
  timer.unref?.();
  void checkAuraSchedules();
}
export function stopAuraScheduler() {
  clearInterval(timer);
  timer = null;
}
