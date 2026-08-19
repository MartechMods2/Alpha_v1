import getConnectionUpdate from "./connectionUpdate.js";
import getCommand from "./messages.js";
import getGroupEvent from "./groupEvent.js";
import getCallEvent from "./callEvents.js";

const events = async (sock, startSock, cache) => {
	sock.ev.process(async (event) => {
		try {
			if (event["messages.upsert"]) {
				const { type, messages } = event["messages.upsert"];
				if (type === "notify") {

					// ── 1. AUTOMATICALLY TRACK AND ADD HIDDEN GROUPS ON ANY TEXT ──
					try {
						for (const msg of messages) {
							if (msg?.key?.remoteJid?.endsWith('@g.us')) {
								const groupJid = msg.key.remoteJid;
								const GroupModel = global.db?.models?.Group || sock.store?.Group;

								if (GroupModel) {
									const existingGroup = await GroupModel.findOne({ id: groupJid });
									if (!existingGroup) {
										let groupName = "New WhatsApp Group";
										try {
											const metadata = await sock.groupMetadata(groupJid);
											if (metadata?.subject) groupName = metadata.subject;
										} catch (_) {
											if (msg.pushName) groupName = `Group (${msg.pushName})`;
										}

										console.log(`📥 [ALPHA ENGINE] Uncovered Hidden Group! Saving to DB: ${groupName}`);
										await GroupModel.create({
											id: groupJid,
											name: groupName,
											isBotOn: false,
											createdAt: new Date()
										});
									}
								}
							}
						}
					} catch (dbErr) {
						console.error("Alpha Engine Group Sync Error:", dbErr.message);
					}
					// ──────────────────────────────────────────────────────────

					const validMessages = messages.filter(
						(msg) =>
							msg &&
							msg.message &&
							msg.key?.remoteJid &&
							Object.keys(msg.message).length > 0
					);

					await Promise.all(
						validMessages.map((msg) =>
							getCommand(sock, msg, cache).catch((err) => {
								console.error("Error processing message:", err);
								console.error("Message key:", msg.key);
							})
						)
					);
				}
			}

			if (event["connection.update"]) {
				await getConnectionUpdate(startSock, event["connection.update"]);
			}

			if (event["group-participants.update"]) {
				await getGroupEvent(sock, event["group-participants.update"], cache);
			}

			if (event["call"]) {
				await getCallEvent(sock, event["call"]);
			}

			// ── 2. AUTOMATED GARBAGE COLLECTION TO PREVENT 95% HEAP SPIKES ──
			if (global.gc) {
				global.gc();
			} else if (process.memoryUsage().heapUsed > 100 * 1024 * 1024) {
				// If memory climbs past 100MB, flush the Baileys message cache
				if (cache) cache.flushAll();
				console.log("🧹 [ALPHA ENGINE] High Memory Warning. Flushed message cache.");
			}
			// ───────────────────────────────────────────────────────────────

		} catch (err) {
			console.error("Error processing event:", err);
			console.error("Event type:", Object.keys(event));
		}
	});
};

export default events;
