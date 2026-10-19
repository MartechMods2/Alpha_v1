import { createControlledShutdown } from "./utils/controlledShutdown.js";
import { defenseHealth, beginDraining, startDefenseMonitoring } from "./utils/defenseHealth.js";
import { safeLogParts } from "./utils/safeLog.js";
import startSock, { onNewSock, stopConnections } from "./connection.js";
import { startReminderScheduler } from "./utils/reminderScheduler.js";
import { startGroupAutomationScheduler } from "./utils/groupAutomationScheduler.js";
import getDate from "./utils/date.js";
import { normalizeJID } from "./utils/lid.js";
import adminRouter from "./routes/admin.js";
import messageQueue from "./queue/messageQueue.js";
import { pushLog, subscribe as subscribeAdminEvents, getLogs, getActivity } from "./notify/adminEvents.js";
import { getBotData } from "./db/botData.js";
import { setMediaRuntimeConfig } from "./utils/mediaJobs.js";
import { startSafePackScheduler } from "./utils/safePackScheduler.js";
import { ensureYtDlp, resolveYtDlpJsRuntime } from "./utils/ytdlp.js";
import { consumeAdminWebsocketTicket } from "./utils/adminWebsocket.js";
import { authenticateIntegrationRequest, consumeIntegrationRateLimit, integrationRecipientAllowed } from "./utils/integrationApi.js";

// ── Console interceptor — feeds log ring buffer + deduplication ──────────────
const _log   = console.log.bind(console);
const _info  = console.info.bind(console);
const _warn  = console.warn.bind(console);
const _error = console.error.bind(console);

const _SESSION_SPAM = ['Closing session:', 'Removing old closed session:'];

// Suppress "Credentials saved to MongoDB" within 10s of startup (creds flush storm)
let _startupTime = Date.now();
function _suppressStartupNoise(msg) {
	if (msg === '💾 Credentials saved to MongoDB' && Date.now() - _startupTime < 10000) return true;
	return false;
}

console.log   = (...a) => {
	const s = String(a[0]);
	if (_suppressStartupNoise(s)) return;
	const safe = safeLogParts(a); _log(...safe); pushLog('info', ...safe);
};
console.info  = (...a) => {
	if (_SESSION_SPAM.some(s => String(a[0]).startsWith(s))) return;
	const safe = safeLogParts(a); _info(...safe); pushLog('info', ...safe);
};
console.warn  = (...a) => { const safe=safeLogParts(a); _warn(...safe); pushLog('warn', ...safe); };
console.error = (...a) => { const safe=safeLogParts(a); _error(...safe); pushLog('error', ...safe); };

import cors from "cors";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import bodyParser from "body-parser";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

app.use(
	cors({
		credentials: true,
		optionsSuccessStatus: 200,
	})
);

if (!process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable is not set. Cannot run application securely.");
  process.exit(1);
}

app.use(
	session({
		secret: process.env.SESSION_SECRET,
		resave: false,
		saveUninitialized: false,
		store: MongoStore.create({ mongoUrl: process.env.MONGODB_KEY, ttl: 8 * 60 * 60 }),
		cookie: { secure: "auto", httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 },
	})
);

// ── Passport / Google OAuth ────────────────────────────────────────────────────
const baseUrl = (process.env.HOST_URL || "http://localhost:8000").replace(/\/$/, "");
const googleAuthEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (googleAuthEnabled) {
	passport.use(
		new GoogleStrategy(
			{
				clientID:     process.env.GOOGLE_CLIENT_ID,
				clientSecret: process.env.GOOGLE_CLIENT_SECRET,
				callbackURL:  `${baseUrl}/auth/google/callback`,
			},
			(_accessToken, _refreshToken, profile, done) => done(null, profile)
		)
	);
} else {
	console.log("Google OAuth disabled — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set.");
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(passport.initialize());
app.use(passport.session());
app.locals.googleAuthEnabled = googleAuthEnabled;

app.use(bodyParser.json({ limit: "10mb" }));
app.use(
	express.static(path.join(__dirname, "public"), {
		maxAge: "1d",
		etag: false,
	})
);

// Serve the React dashboard build (public/app/) at /admin
app.use(
	"/admin",
	express.static(path.join(__dirname, "public", "app"), { maxAge: "1d", etag: false })
);

app.set("views", path.join(__dirname, "./public"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const port = process.env.PORT || 8000;

app.get("/", (_req, res) => {
	res.render("index");
});

app.use("/", adminRouter);

// SPA catch-all: any /admin/* path that wasn't handled above → serve React index.html
const reactIndex = path.join(__dirname, "public", "app", "index.html");
app.get("/admin", (_req, res) => res.sendFile(reactIndex));
app.get("/admin/*", (req, res, next) => {
	if (req.path.startsWith("/api/")) return next();
	res.sendFile(reactIndex);
});

const server = app.listen(port, () => {
	const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
	_log(`\n${"═".repeat(50)}`);
	_log(`  Alpha by Martech  ·  ${getDate()}`);
	_log(`  Port: ${port}  ·  Heap: ${mem}MB`);
	_log(`${"═".repeat(50)}\n`);
	startServer();
});

app.on("error", (error) => {
	console.error("Web-server error:", error.message);
});

const wss = new WebSocketServer({
	noServer: true,
	maxPayload: 64 * 1024,
	perMessageDeflate: false,
});

server.on("upgrade", (request, socket, head) => {
	try {
		const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
		if (url.pathname !== "/admin-ws" || !consumeAdminWebsocketTicket(url.searchParams.get("ticket"))) {
			socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
			socket.destroy();
			return;
		}
		wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
	} catch (_) { socket.destroy(); }
});

// ── Bot connection state ───────────────────────────────────────────────────────
// Persists across sock reconnections via the onNewSock hook in connection.js
let botConnected = false;
let lastQR       = null;   // Last QR code received; replayed to late-joining browser clients
let lastQRTimer  = null;   // Timer to clear lastQR after it expires (~60 s)

function broadcast(payload) {
	const msg = JSON.stringify(payload);
	wss.clients.forEach((client) => {
		if (client.bufferedAmount > 1048576) { client.terminate(); return; }
        if (client.readyState === WebSocket.OPEN) client.send(msg);
	});
}

// ── Called for every new sock — including reconnects ─────────────────────────
// This is the fix for the stale-sock bug: we always attach our listener to
// whichever sock is currently live, and always keep app.locals.sock current.
function handleNewSock(sock) {
	sock.alphaConnected = false;
	app.locals.sock = sock; // always up-to-date reference for admin routes

	sock.ev.on("connection.update", (update) => {
		if (app.locals.sock !== sock) return;
		const { qr, isOnline, connection } = update;

		if (qr) {
			botConnected = false;
			// QR credentials must not be exposed on the public landing page. The
			// protected dashboard and one-time phone-pair invitations are preferred.
			if (String(process.env.PUBLIC_QR_ENABLED || "false").toLowerCase() === "true") {
				lastQR = qr;
				clearTimeout(lastQRTimer);
				lastQRTimer = setTimeout(() => { lastQR = null; }, 60_000);
				broadcast({ type: "qr", qr });
			} else {
				lastQR = null;
				broadcast({ type: "status", status: "awaiting_secure_pairing" });
			}
		}

		if (isOnline || connection === "open") {
			botConnected = true;
            sock.alphaConnected = true;
			lastQR = null;
			clearTimeout(lastQRTimer);
			broadcast({ type: "status", status: "connected" });
		}

		if (connection === "close") {
			botConnected = false;
            sock.alphaConnected = false;
			broadcast({ type: "status", status: "disconnected" });
		}
	});
}

// Register hook before calling startSock so it fires for the very first sock too
onNewSock(handleNewSock);

// Forward admin events (logs, activity) to all connected WS clients
subscribeAdminEvents(event => broadcast(event));

// Expose startSock so admin routes can trigger a reconnect without restarting the process
app.locals.reconnect = () => startSock("manual-reconnect");

// ── WebSocket server ──────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
    if (wss.clients.size > 16) { ws.close(1013); return; }
    let alive = true;
	// Tell newly connected browser clients the current state immediately.
	// Also check sock.user as a live fallback in case botConnected is stale.
	const isConnected = botConnected || app.locals.sock?.alphaConnected === true;
	if (isConnected) {
		botConnected = true; // sync flag
		ws.send(JSON.stringify({ type: "status", status: "connected" }));
	} else if (lastQR) {
		// Browser missed the QR broadcast — replay the stored copy
		ws.send(JSON.stringify({ type: "qr", qr: lastQR }));
	}

	// Replay recent logs + activity to newly connected clients
	ws.send(JSON.stringify({ type: 'log_snapshot',      logs:     getLogs(100) }));
	ws.send(JSON.stringify({ type: 'activity_snapshot', activity: getActivity() }));

	const heartbeat = setInterval(() => {
		if (!alive) { ws.terminate(); return; }
        alive = false;
		if (ws.readyState === WebSocket.OPEN) ws.ping();
	}, 30_000);

	ws.on("pong", () => { alive = true; });

	// Dashboard sockets are read-only. Mutations use authenticated HTTP routes.
	ws.on("message", () => ws.send(JSON.stringify({ type: "error", error: "Dashboard WebSocket is read-only." })));

	ws.on("close", () => clearInterval(heartbeat));
	ws.on("error", (err) => { console.error("WebSocket error:", err); clearInterval(heartbeat); });
});

// ── Bot start ─────────────────────────────────────────────────────────────────
async function startServer() {
	try {
		const [ytDlp, jsRuntime] = await Promise.all([ensureYtDlp(), resolveYtDlpJsRuntime()]);
		console.log(`✅ yt-dlp ${ytDlp.version} ready (${ytDlp.source}); JS runtime: ${jsRuntime || "unavailable"}`);
	} catch (error) {
		console.warn(`⚠️ YouTube downloads unavailable at startup: ${error.message}`);
	}
	try {
		const botData = await getBotData();
		if (botData && typeof botData === "object" && botData.mediaConfig) {
			setMediaRuntimeConfig(botData.mediaConfig);
		}
	} catch (error) {
		console.warn("Could not load the saved Media Studio configuration:", error.message);
	}
	await startSock("start");
	startReminderScheduler();
	startGroupAutomationScheduler();
	startSafePackScheduler();
	// handleNewSock() is called by the onNewSock hook inside connection.js,
	// so app.locals.sock and connection.update listener are both set up there.

	app.post("/send", async (req, res) => {
		const auth = authenticateIntegrationRequest(req.headers.authorization);
		if (!auth.ok) return res.status(auth.status).send({ message: auth.error });
		const quota = consumeIntegrationRateLimit(req.ip);
		if (!quota.ok) {
			res.set("Retry-After", String(quota.retryAfter));
			return res.status(429).send({ message: "Integration rate limit exceeded." });
		}
		const { to, message } = req.body;
		if (!to || !message) {
			return res.status(400).send({ message: "Invalid request" });
		}
		if (typeof message !== "string" || message.length > 4096) return res.status(400).send({ message: "Message must be 1-4096 characters." });
		if (Array.isArray(to) && to.length > 3) return res.status(400).send({ message: "Maximum three allowlisted recipients per request." });

		try {
			const sock = app.locals.sock; // live reference
			if (Array.isArray(to)) {
				const jids = await Promise.all(to.map((r) => normalizeJID(sock, r)));
				if (jids.some((jid) => !integrationRecipientAllowed(jid))) return res.status(403).send({ message: "Recipient is not allowlisted." });
				await Promise.all(jids.map((jid) => messageQueue.enqueue(jid, () => sock.sendMessage(jid, { text: message }), 0)));
				console.log("Message queued for multiple recipients");
				return res.send({ message: "Messages queued" });
			} else {
				const recipientJid = await normalizeJID(sock, to);
				if (!integrationRecipientAllowed(recipientJid)) return res.status(403).send({ message: "Recipient is not allowlisted." });
				await messageQueue.enqueue(recipientJid, () => sock.sendMessage(recipientJid, { text: message }), 0);
				console.log("Message queued for:", to);
				return res.send({ message: "Message queued" });
			}
		} catch (error) {
			console.error("Error sending message:", error);
			return res.status(500).send({ message: "Failed to send message" });
		}
	});
}

const stopMonitoring = startDefenseMonitoring();
const shutdown = createControlledShutdown({
 begin: () => { console.warn("[PROCESS] Controlled shutdown started."); beginDraining(); stopMonitoring(); messageQueue.stop(); },
 flush: () => app.locals.sock?.flushAuth?.(),
 closeSockets: () => { stopConnections(); for(const client of wss.clients) client.terminate(); wss.close(); },
 closeServer: () => new Promise(resolve => { server.close(resolve); server.closeIdleConnections?.(); }),
});
function gracefulShutdown(_signal, exitCode=0) { return shutdown(exitCode); }
process.on("alpha:fatal", () => gracefulShutdown("DEFENSE_FATAL", 1));
process.on("unhandledRejection", () => gracefulShutdown("UNHANDLED_REJECTION", 1));
process.on("uncaughtException", () => gracefulShutdown("UNCAUGHT_EXCEPTION", 1));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
