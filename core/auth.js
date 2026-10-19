import { BufferJSON, initAuthCreds, proto } from "baileys";
import mdClient from "../db/client.js";

const FLUSH_INTERVAL_MS = 5000; // non-critical flush
const MAX_BUFFER_SIZE = 500; // safety cap

const useMongoDBAuthState = async () => {
	const collection = mdClient.db("MyBotDataDB").collection("AuthState");

	// in-memory buffer for non-critical writes
	const buffer = new Map();
	let flushTimer = null;

	const CRITICAL_PREFIXES = ["creds", "session", "pre-key", "sender-key"];

	const isCritical = (key) => CRITICAL_PREFIXES.some((p) => key.startsWith(p));

	// ───────────────── READ ─────────────────
	const readData = async (key) => {
		const doc = await collection.findOne({ _id: key });
		if (!doc?.value) return null;
        if (typeof doc.value !== "string" || doc.value.length > 2097152) throw new Error("Stored auth record exceeds its limit");
		return JSON.parse(doc.value, BufferJSON.reviver);
	};

	// ───────────────── WRITE (critical) ─────────────────
	const writeCriticalBulk = async (ops) => {
		if (!ops.length) return;
		await collection.bulkWrite(ops, { ordered: false });
	};

	// ───────────────── BUFFER (non-critical) ─────────────────
	const bufferWrite = (key, value) => {
        if (buffer.size >= MAX_BUFFER_SIZE && !buffer.has(key)) { process.emit("alpha:fatal", "auth-buffer-capacity"); throw new Error("Auth write buffer reached capacity"); }
		buffer.set(key, { value });

		if (buffer.size >= MAX_BUFFER_SIZE) {
			flushBuffer().catch(() => process.emit("alpha:fatal", "auth-flush"));
		}
	};

	let flushing = null;
	const flushBuffer = () => {
        if (flushing) return flushing;
        flushing = flushSnapshot().finally(() => { flushing = null; });
        return flushing;
    };
    const flushSnapshot = async () => {
		if (!buffer.size) return;

		const snapshot = new Map(buffer);
        const ops = [];
		for (const [key, entry] of snapshot) {
			ops.push({
				updateOne: {
					filter: { _id: key },
					update: {
						$set: {
							value: JSON.stringify(entry.value, BufferJSON.replacer),
						},
					},
					upsert: true,
				},
			});
		}

		await collection.bulkWrite(ops, { ordered: false });
        for (const [key, entry] of snapshot) if (buffer.get(key) === entry) buffer.delete(key);
	};

	// background flush loop
	flushTimer = setInterval(() => {
		flushBuffer().catch(() => process.emit("alpha:fatal", "auth-flush"));
	}, FLUSH_INTERVAL_MS);

	// ───────────────── CREDS ─────────────────
	const creds = (await readData("creds")) || initAuthCreds();

	// ───────────────── STATE ─────────────────
	return {
		state: {
			creds,
			keys: {
				get: async (type, ids) => {
					const keys = ids.map((id) => `${type}-${id}`);
					const docs = await collection.find({ _id: { $in: keys } }).toArray();
					const byKey = {};
					for (const doc of docs) {
						if (doc?.value) byKey[doc._id] = JSON.parse(doc.value, BufferJSON.reviver);
					}
					const data = {};
					for (const id of ids) {
						let value = byKey[`${type}-${id}`] ?? null;
						if (type === "app-state-sync-key" && value) {
							value = proto.Message.AppStateSyncKeyData.fromObject(value);
						}
						data[id] = value;
					}
					return data;
				},

				set: async (data) => {
					const criticalOps = [];

					for (const category in data) {
						for (const id in data[category]) {
							const value = data[category][id];
							const key = `${category}-${id}`;

							if (value == null) {
                                buffer.delete(key);
                                criticalOps.push({ deleteOne: { filter: { _id: key } } });
                                continue;
                            }

							if (isCritical(key)) {
								criticalOps.push({
									updateOne: {
										filter: { _id: key },
										update: {
											$set: {
												value: JSON.stringify(value, BufferJSON.replacer),
											},
										},
										upsert: true,
									},
								});
							} else {
								bufferWrite(key, value);
							}
						}
					}

					await writeCriticalBulk(criticalOps);
				},
			},
		},

		saveCreds: async () => {
			await collection.updateOne(
				{ _id: "creds" },
				{ $set: { value: JSON.stringify(creds, BufferJSON.replacer) } },
				{ upsert: true }
			);
		},

		// Cleanup function to prevent memory leaks on reconnection
		cleanup: async () => {
			if (flushTimer) {
				clearInterval(flushTimer);
				flushTimer = null;
			}
			// Flush remaining buffer before clearing
			await flushBuffer();
            await flushBuffer();
			console.log("🧹 Auth state cleanup completed");
		},
	};
};

const clearMongoDBAuthState = async () => {
	try {
		const collection = mdClient.db("MyBotDataDB").collection("AuthState");
		const result = await collection.deleteMany({});
		console.log(`🗑️ Cleared ${result.deletedCount} auth state documents from MongoDB`);
		return result.deletedCount;
	} catch (error) {
		console.error("Error clearing MongoDB auth state:", error);
		return 0;
	}
};

const getAuthStateStats = async () => {
	try {
		const collection = mdClient.db("MyBotDataDB").collection("AuthState");
		const count = await collection.countDocuments();

		// Count by type
		const types = await collection
			.aggregate([
				{
					$project: {
						type: {
							$arrayElemAt: [{ $split: ["$_id", "-"] }, 0],
						},
					},
				},
				{
					$group: {
						_id: "$type",
						count: { $sum: 1 },
					},
				},
			])
			.toArray();

		return {
			total: count,
			byType: types.reduce((acc, item) => {
				acc[item._id] = item.count;
				return acc;
			}, {}),
		};
	} catch (error) {
		console.error("Error getting auth state stats:", error);
		return { total: 0, byType: {} };
	}
};

export { useMongoDBAuthState, clearMongoDBAuthState, getAuthStateStats };
