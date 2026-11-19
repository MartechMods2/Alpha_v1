import { DisconnectReason } from "baileys";
const getConnectionUpdate = async (startSock, update) => {
  if (!update || typeof update !== "object") return;
  if (update.connection === "open") {
    await startSock("connection-open");
    console.log("[CONNECTION] Connected.");
  }
  if (update.connection === "close") {
    const code = update.lastDisconnect?.error?.output?.statusCode;
    const reason = Object.entries(DisconnectReason).find(
      ([name, value]) => typeof value === "number" && value === code,
    )?.[0] || "unknown";
    console.warn(`[CONNECTION] Closed: code=${Number.isInteger(code) ? code : "unknown"} reason=${reason}`);
    // Replacement/conflict is not a reason to fight a second active session.
    if (
      [
        DisconnectReason.loggedOut,
        DisconnectReason.connectionReplaced,
        DisconnectReason.badSession,
        DisconnectReason.multideviceMismatch,
      ]
        .filter(Number.isInteger)
        .includes(code)
    ) {
      await startSock("session-stop");
      console.warn(
        "[CONNECTION] Session requires manual review; credentials retained.",
      );
    } else {
      await startSock("reconnect");
    }
  }
};
export default getConnectionUpdate;
