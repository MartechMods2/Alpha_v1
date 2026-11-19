// Keep process liveness separate from WhatsApp readiness: a session conflict
// needs operator review, not an endless host restart loop.
export function botHealth(health, connected) {
  return {
    status: health.status === "ok" && !connected ? "degraded" : health.status,
    whatsapp: connected ? "connected" : "disconnected",
  };
}
