import notifyOwner from "../notify/owner.js";
import { escapeHtml } from "../notify/telegram.js";

// ============================================================================
// ⚡ ALPHA CALL MANAGER
// ============================================================================
//
// Default behavior:
// - Incoming calls are NOT automatically rejected.
// - Owner gets notified about incoming calls.
// - Voice/video calls are identified.
// - Duplicate call events are ignored.
// - Optional automatic rejection can be enabled with environment variables.
//
// Render environment variables:
//
// ALPHA_AUTO_REJECT_CALLS=false
// ALPHA_NOTIFY_CALLS=true
//
// Optional:
// ALPHA_ALLOWED_CALLERS=234XXXXXXXXXX,234YYYYYYYYYY
// ALPHA_REJECT_UNKNOWN_CALLERS=false
//
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================

const AUTO_REJECT_CALLS =
	String(
		process.env.ALPHA_AUTO_REJECT_CALLS || "false"
	).toLowerCase() === "true";

const NOTIFY_OWNER =
	String(
		process.env.ALPHA_NOTIFY_CALLS || "true"
	).toLowerCase() !== "false";

const REJECT_UNKNOWN_CALLERS =
	String(
		process.env.ALPHA_REJECT_UNKNOWN_CALLERS || "false"
	).toLowerCase() === "true";

// ============================================================================
// ALLOWED CALLERS
// ============================================================================
//
// Example:
//
// ALPHA_ALLOWED_CALLERS=2348012345678,2348098765432
//
// The numbers are normalized automatically.
// ============================================================================

const allowedCallers = String(
	process.env.ALPHA_ALLOWED_CALLERS || ""
)
	.split(",")
	.map((number) => normalizeNumber(number))
	.filter(Boolean);

// ============================================================================
// CALL EVENT MEMORY
// ============================================================================
//
// WhatsApp/Baileys can produce multiple updates for the same call.
// We remember recent call IDs so Alpha doesn't send repeated notifications.
// ============================================================================

const processedCalls = new Map();

const CALL_MEMORY_TIME = 5 * 60 * 1000; // 5 minutes

function rememberCall(callId) {
	if (!callId) return;

	processedCalls.set(callId, Date.now());

	cleanupProcessedCalls();
}

function hasRecentlyProcessed(callId) {
	if (!callId) return false;

	const timestamp = processedCalls.get(callId);

	if (!timestamp) {
		return false;
	}

	if (
		Date.now() - timestamp >
		CALL_MEMORY_TIME
	) {
		processedCalls.delete(callId);
		return false;
	}

	return true;
}

function cleanupProcessedCalls() {
	const now = Date.now();

	for (const [callId, timestamp] of processedCalls.entries()) {
		if (now - timestamp > CALL_MEMORY_TIME) {
			processedCalls.delete(callId);
		}
	}
}

// ============================================================================
// NUMBER NORMALIZATION
// ============================================================================

function normalizeNumber(value) {
	if (!value) return "";

	return String(value)
		.replace(/@s\.whatsapp\.net$/i, "")
		.replace(/@lid$/i, "")
		.replace(/[^0-9]/g, "");
}

// ============================================================================
// CALLER CHECK
// ============================================================================

function isCallerAllowed(callFrom) {
	if (!allowedCallers.length) {
		return false;
	}

	const callerNumber =
		normalizeNumber(callFrom);

	return allowedCallers.includes(
		callerNumber
	);
}

// ============================================================================
// CALL TYPE
// ============================================================================

function getCallType(call) {
	if (call?.isVideo === true) {
		return "Video";
	}

	return "Voice";
}

// ============================================================================
// CALL STATUS LABEL
// ============================================================================

function getStatusLabel(status) {
	switch (status) {
		case "offer":
			return "Incoming";

		case "ringing":
			return "Ringing";

		case "preaccept":
			return "Pre-accepted";

		case "transport":
			return "Transporting";

		case "relaylatency":
			return "Relay latency update";

		case "accept":
			return "Accepted";

		case "reject":
			return "Rejected";

		case "timeout":
			return "Timed out";

		case "terminate":
		case "terminated":
			return "Terminated";

		default:
			return status || "Unknown";
	}
}

// ============================================================================
// OWNER NOTIFICATION
// ============================================================================

async function notifyCallOwner(
	sock,
	call,
	action = "Received"
) {
	if (!NOTIFY_OWNER) {
		return;
	}

	try {
		const callType =
			getCallType(call);

		const caller =
			call?.from || "Unknown";

		const status =
			getStatusLabel(call?.status);

		const allowed =
			isCallerAllowed(caller);

		const message =
			`📞 <b>⚡Alpha⚡ Call Alert</b>\n` +
			`━━━━━━━━━━━━━━━━━━\n` +
			`📱 <b>Type:</b> ${escapeHtml(callType)}\n` +
			`👤 <b>From:</b> <code>${escapeHtml(caller)}</code>\n` +
			`📊 <b>Status:</b> ${escapeHtml(status)}\n` +
			`⚙️ <b>Action:</b> ${escapeHtml(action)}\n` +
			`🔐 <b>Allowed:</b> ${allowed ? "Yes" : "No"}\n` +
			`🆔 <b>Call ID:</b> <code>${escapeHtml(call?.id || "Unknown")}</code>`;

		notifyOwner(sock, message);
	} catch (error) {
		console.error(
			"⚡Alpha⚡ call notification error:",
			error
		);
	}
}

// ============================================================================
// REJECT CALL
// ============================================================================

async function rejectIncomingCall(
	sock,
	call,
	reason
) {
	try {
		if (!call?.id || !call?.from) {
			console.warn(
				"⚠️ Cannot reject call: missing call ID or caller."
			);

			return false;
		}

		await sock.rejectCall(
			call.id,
			call.from
		);

		console.log(
			`📞 [⚡Alpha⚡] ${getCallType(
				call
			)} call rejected from ${call.from} (${reason})`
		);

		await notifyCallOwner(
			sock,
			call,
			`Rejected - ${reason}`
		);

		return true;
	} catch (error) {
		console.error(
			`❌ [⚡Alpha⚡] Failed to reject call from ${call?.from}:`,
			error
		);

		await notifyCallOwner(
			sock,
			call,
			"Failed to reject"
		);

		return false;
	}
}

// ============================================================================
// MAIN CALL EVENT HANDLER
// ============================================================================

const getCallEvent = async (sock, call) => {
	if (!Array.isArray(call)) {
		console.warn(
			"⚠️ [⚡Alpha⚡] Invalid call event received."
		);

		return;
	}

	for (const c of call) {
		try {
			if (!c) {
				continue;
			}

			const callId = c.id;
			const caller = c.from;

			// --------------------------------------------------------------------
			// Ignore malformed events
			// --------------------------------------------------------------------

			if (!callId || !caller) {
				console.warn(
					"⚠️ [⚡Alpha⚡] Received malformed call event:",
					c
				);

				continue;
			}

			// --------------------------------------------------------------------
			// Clean up memory periodically
			// --------------------------------------------------------------------

			cleanupProcessedCalls();

			// --------------------------------------------------------------------
			// INCOMING CALL
			// --------------------------------------------------------------------

			if (c.status === "offer") {
				const callType =
					getCallType(c);

				const allowed =
					isCallerAllowed(caller);

				console.log(
					`📞 [⚡Alpha⚡] Incoming ${callType} call from ${caller}`
				);

				console.log(
					`🔐 [⚡Alpha⚡] Caller allowed: ${allowed}`
				);

				// ---------------------------------------------------------------
				// Duplicate protection
				// ---------------------------------------------------------------

				if (
					hasRecentlyProcessed(
						callId
					)
				) {
					console.log(
						`♻️ [⚡Alpha⚡] Duplicate call event ignored: ${callId}`
					);

					continue;
				}

				rememberCall(callId);

				// ---------------------------------------------------------------
				// AUTOMATIC REJECTION MODE
				// ---------------------------------------------------------------
				//
				// IMPORTANT:
				// This is OFF by default.
				//
				// If ALPHA_AUTO_REJECT_CALLS=true:
				//
				// 1. Allowed callers are NOT rejected.
				// 2. If ALPHA_REJECT_UNKNOWN_CALLERS=true,
				//    unknown callers are rejected.
				//
				// ---------------------------------------------------------------

				if (AUTO_REJECT_CALLS) {
					if (allowed) {
						console.log(
							`✅ [⚡Alpha⚡] Allowed caller ${caller}; call will NOT be rejected.`
						);

						await notifyCallOwner(
							sock,
							c,
							"Allowed - Not rejected"
						);

						continue;
					}

					if (
						REJECT_UNKNOWN_CALLERS
					) {
						await rejectIncomingCall(
							sock,
							c,
							"Unknown caller"
						);

						continue;
					}

					// Auto reject is enabled but unknown
					// caller rejection is disabled.
					console.log(
						`📞 [⚡Alpha⚡] Unknown caller ${caller}; call left untouched.`
					);

					await notifyCallOwner(
						sock,
						c,
						"Unknown caller - Left untouched"
					);

					continue;
				}

				// ---------------------------------------------------------------
				// NORMAL MODE
				// ---------------------------------------------------------------
				//
				// This is the DEFAULT.
				//
				// Alpha does NOT reject the call.
				//
				// This fixes the original problem where every call was
				// automatically rejected.
				// ---------------------------------------------------------------

				await notifyCallOwner(
					sock,
					c,
					allowed
						? "Allowed - Call left untouched"
						: "Call left untouched"
				);

				continue;
			}

			// --------------------------------------------------------------------
			// RINGING
			// --------------------------------------------------------------------

			if (c.status === "ringing") {
				console.log(
					`🔔 [⚡Alpha⚡] ${getCallType(
						c
					)} call is ringing from ${caller}`
				);

				continue;
			}

			// --------------------------------------------------------------------
			// PRE-ACCEPT
			// --------------------------------------------------------------------

			if (c.status === "preaccept") {
				console.log(
					`📞 [⚡Alpha⚡] Call pre-accepted from ${caller}`
				);

				continue;
			}

			// --------------------------------------------------------------------
			// TRANSPORT
			// --------------------------------------------------------------------

			if (c.status === "transport") {
				console.log(
					`🌐 [⚡Alpha⚡] Call transport update from ${caller}`
				);

				continue;
			}

			// --------------------------------------------------------------------
			// RELAY LATENCY
			// --------------------------------------------------------------------

			if (
				c.status === "relaylatency"
			) {
				console.log(
					`📡 [⚡Alpha⚡] Call relay latency update from ${caller}`
				);

				continue;
			}

			// --------------------------------------------------------------------
			// ACCEPTED
			// --------------------------------------------------------------------

			if (c.status === "accept") {
				console.log(
					`✅ [⚡Alpha⚡] Call accepted from ${caller}`
				);

				continue;
			}

			// --------------------------------------------------------------------
			// REJECTED
			// --------------------------------------------------------------------

			if (c.status === "reject") {
				console.log(
					`🚫 [⚡Alpha⚡] Call rejected from ${caller}`
				);

				continue;
			}

			// --------------------------------------------------------------------
			// TIMEOUT
			// --------------------------------------------------------------------

			if (c.status === "timeout") {
				console.log(
					`⏱️ [⚡Alpha⚡] Call timed out from ${caller}`
				);

				continue;
			}

			// --------------------------------------------------------------------
			// TERMINATED
			// --------------------------------------------------------------------

			if (
				c.status === "terminated" ||
				c.status === "terminate"
			) {
				console.log(
					`📴 [⚡Alpha⚡] Call terminated from ${caller}`
				);

				continue;
			}

			// --------------------------------------------------------------------
			// UNKNOWN STATUS
			// --------------------------------------------------------------------

			console.log(
				`ℹ️ [⚡Alpha⚡] Unhandled call status "${c.status}" from ${caller}`
			);
		} catch (error) {
			console.error(
				"❌ [⚡Alpha⚡] Error processing call event:",
				error
			);
		}
	}
};

// ============================================================================
// EXPORT
// ============================================================================

export default getCallEvent;
