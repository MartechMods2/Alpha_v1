import { messageQuarantine } from "../utils/ingestionQuarantine.js";
import { startIntegrationWatches } from "../utils/integrationWatches.js";
import { ingestionDefense, defenseConfig } from "../utils/ingestionDefense.js";
import { registerRuntimeCache } from "../utils/runtimeMaintenance.js";
import getConnectionUpdate from "./connectionUpdate.js";
import getCommand from "./messages.js";
import getGroupEvent from "./groupEvent.js";
import getCallEvent from "./callEvents.js";
import {
  handleInteractivePollUpdate,
  handleInteractivePollMessage,
} from "../utils/pollManager.js";
import { handleOwnerMentionReaction } from "../utils/ownerMentionReaction.js";
import { handleAfkPresence } from "../utils/afkPresence.js";
import { restoreActiveTruthDareSessions } from "../utils/truthDareHost.js";
import { restoreActiveAutoGames } from "../utils/autoGameHost.js";
let serviceId = 0;
const syncedGroups = new Map();
async function syncGroup(sock, msg) {
  const jid = msg.key.remoteJid;
  const model = global.db?.models?.Group || sock.store?.Group;
  if (
    !jid.endsWith("@g.us") ||
    !model ||
    (syncedGroups.get(jid) || 0) > Date.now()
  )
    return;
  try {
    if (!(await model.findOne({ id: jid }))) {
      let name = "New WhatsApp Group";
      try {
        name = String((await sock.groupMetadata(jid))?.subject || name).slice(
          0,
          256,
        );
      } catch {}
      await model.create({
        id: jid,
        name,
        isBotOn: false,
        createdAt: new Date(),
      });
    }
    while (syncedGroups.size >= 1000)
      syncedGroups.delete(syncedGroups.keys().next().value);
    syncedGroups.set(jid, Date.now() + 600000);
  } catch {
    console.warn("[DEFENSE] Group discovery failed; payload suppressed.");
  }
}
const events = async (sock, startSock, cache) => {
  await messageQuarantine.load();
  startIntegrationWatches(sock);
  const releaseCache = registerRuntimeCache(cache);
  let closed = false,
    recovered = false;
  sock.ws?.on?.("close", () => {
    closed = true;
    releaseCache();
  });
  sock.ev.process(async (event) => {
    if (!event || typeof event !== "object") return;
    try {
      // Transport lifecycle must never wait behind chat work.
      const connection = event["connection.update"];
      if (connection) {
        await getConnectionUpdate(startSock, connection);
        if (connection.connection === "open" && !recovered) {
          recovered = true;
          void Promise.allSettled([
            restoreActiveTruthDareSessions({ sock }),
            restoreActiveAutoGames({ sock }),
          ]);
        }
      }
      if (closed) return;
      const tasks = [],
        batch = defenseConfig().batch;
      const upsert = event["messages.upsert"];
      if (
        upsert &&
        Array.isArray(upsert.messages) &&
        ["notify", "append"].includes(upsert.type)
      ) {
        for (let i = 0; i < Math.min(upsert.messages.length, batch); i++)
          tasks.push(
            ingestionDefense.submit(upsert.messages[i], async (msg) => {
              if (closed) return;
              if (await handleInteractivePollMessage(sock, msg)) return;
              if (upsert.type !== "notify") return;
              // Exception boundaries record aggregate failures, never payloads or identifiers.
              await syncGroup(sock, msg);
              await handleOwnerMentionReaction(sock, msg).catch(() => {});
              await handleAfkPresence(sock, msg).catch(() => {});
              await getCommand(sock, msg, cache);
            }),
          );
      }
      const updates = event["messages.update"];
      if (Array.isArray(updates))
        for (let i = 0; i < Math.min(updates.length, batch); i++) {
          const item = updates[i];
          if (!item?.update?.pollUpdates) continue;
          tasks.push(
            ingestionDefense.submit(
              { key: item.key, message: { pollState: item.update } },
              (msg) =>
                closed
                  ? undefined
                  : handleInteractivePollUpdate(sock, {
                      key: msg.key,
                      update: msg.message.pollState,
                    }),
              { kind: "poll-state" },
            ),
          );
        }
      const groupEvent = event["group-participants.update"];
      if (
        groupEvent &&
        Array.isArray(groupEvent.participants) &&
        groupEvent.participants.length <= 128
      ) {
        tasks.push(
          ingestionDefense.submit(
            {
              key: {
                remoteJid: groupEvent.id,
                id: "service-" + ++serviceId,
                participant: "service@lid",
              },
              message: { groupEvent },
            },
            (msg) =>
              closed
                ? undefined
                : getGroupEvent(sock, msg.message.groupEvent, cache),
            { kind: "group-event" },
          ),
        );
      }
      const calls = event.call;
      if (Array.isArray(calls))
        for (const call of calls.slice(0, Math.min(batch, 16)))
          if (typeof call?.from === "string")
            tasks.push(
              ingestionDefense.submit(
                {
                  key: {
                    remoteJid: call.from,
                    id: call.id,
                    participant: call.from,
                  },
                  message: { call },
                },
                (msg) =>
                  closed ? undefined : getCallEvent(sock, [msg.message.call]),
                { kind: "call" },
              ),
            );
      await Promise.allSettled(tasks);
    } catch {
      console.warn("[DEFENSE] Event boundary rejected an event.");
    }
  });
};
export default events;
