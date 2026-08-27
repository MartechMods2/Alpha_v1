import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const uri = process.env.MONGODB_KEY;
const mdClient = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

(async () => {
	try {
		await mdClient.connect();
		console.log("Connected to MongoDB");

		const db = mdClient.db("MyBotDataDB");
		const collections = await db.listCollections().toArray();
		const collectionNames = collections.map((col) => col.name);

		if (!collectionNames.includes("AuthTable")) {
			await db.createCollection("AuthTable");
			console.log("Created AuthTable collection");
		}

		// Index for group member queries ($inc / $set by members.id)
		// Use sparse: true to match any existing index definition and avoid conflicts
		await db.collection("Groups").createIndex({ "members.id": 1 }, { background: true, sparse: true });
		await db.collection("GameScores").createIndex(
			{ groupJid: 1, points: -1, wins: -1, bestStreak: -1 },
			{ background: true },
		);
		await db.collection("GameDailyChallenges").createIndex(
			{ groupJid: 1, dateKey: -1 },
			{ background: true },
		);
		await db.collection("GameDailyChallenges").createIndex(
			{ expiresAt: 1 },
			{ background: true, expireAfterSeconds: 0 },
		);
		await db.collection("GroupTools").createIndex(
			{ updatedAt: -1 },
			{ background: true },
		);
		await Promise.all([
			db.collection("StickerVault").createIndex({ groupJid: 1, createdAt: -1 }, { background: true }),
			db.collection("MediaContests").createIndex({ groupJid: 1, status: 1 }, { background: true }),
			db.collection("MemeTemplates").createIndex({ nameKey: 1 }, { background: true, unique: true }),
			db.collection("GameTeams").createIndex({ groupJid: 1, nameKey: 1 }, { background: true, unique: true }),
			db.collection("GameTeams").createIndex({ groupJid: 1, "members.jid": 1 }, { background: true }),
			db.collection("GroupTrophies").createIndex({ groupJid: 1, awardedAt: -1 }, { background: true }),
			db.collection("WeeklyMissions").createIndex({ groupJid: 1, memberJid: 1, week: 1 }, { background: true }),
			db.collection("ActionStats").createIndex({ groupJid: 1, sent: -1, received: -1 }, { background: true }),
			db.collection("GroupAutomations").createIndex({ updatedAt: -1 }, { background: true }),
			db.collection("AutomationDeliveries").createIndex({ createdAt: 1 }, { background: true, expireAfterSeconds: 400 * 24 * 60 * 60 }),
		]);
	} catch (err) {
		console.error("Error connecting to MongoDB:", err);
	}
})();

export default mdClient;
