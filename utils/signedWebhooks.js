import { createHmac, timingSafeEqual } from "node:crypto";

const allowedEvents = new Set(["moderation.audit", "bot.error", "backup.completed", "bot.health"]);
export const webhookConfigured = () => Boolean(process.env.OUTBOUND_WEBHOOK_URL && process.env.OUTBOUND_WEBHOOK_SECRET);

export const emitSignedWebhook = async (event, data) => {
	if (!webhookConfigured() || !allowedEvents.has(event)) return { sent: false, reason: "not-configured" };
	const timestamp = String(Date.now()); const body = JSON.stringify({ event, timestamp, data }); const signature = createHmac("sha256", process.env.OUTBOUND_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex");
	const response = await fetch(process.env.OUTBOUND_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Alpha-Event": event, "X-Alpha-Timestamp": timestamp, "X-Alpha-Signature": `sha256=${signature}` }, body, signal: AbortSignal.timeout(10_000) });
	if (!response.ok) throw new Error(`Webhook returned ${response.status}`); return { sent: true };
};

export const verifyWebhookSignature = ({ body, timestamp, signature, secret = process.env.OUTBOUND_WEBHOOK_SECRET }) => {
	if (!secret || !timestamp || !signature || Math.abs(Date.now() - Number(timestamp)) > 5 * 60_000) return false; const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest(); const supplied = Buffer.from(String(signature).replace(/^sha256=/, ""), "hex"); return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};

