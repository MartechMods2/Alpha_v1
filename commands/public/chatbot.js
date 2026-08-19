import dotenv from "dotenv";
dotenv.config();

// -------------------------------------------------------------------------------------------------------------
// Database / utility imports
// -------------------------------------------------------------------------------------------------------------//
import { getGroupData, group } from "../../db/groupData.js";
import { getMemberData } from "../../db/members.js";
import { extractPhoneNumber } from "../../utils/lid.js";
import { getChatMessages } from "../../utils/chatLogger.js";

// -------------------------------------------------------------------------------------------------------------
// NVIDIA AI CONFIGURATION
// -------------------------------------------------------------------------------------------------------------//

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

// NVIDIA free/serverless model
const NVIDIA_MODEL = "openai/gpt-oss-20b";

// Maximum input size
const MAX_INPUT_WORDS = 500;

// Maximum amount of stored AI history
const MAX_HISTORY_MESSAGES = 20;

// -------------------------------------------------------------------------------------------------------------
// PRIVATE CHAT SETTING
// -------------------------------------------------------------------------------------------------------------
//
// false = Alpha only works inside activated groups.
// true  = Alpha can also answer private chats.
//
// You can also control this from Render by adding:
//
// ALPHA_PRIVATE_CHAT=true
//
// -------------------------------------------------------------------------------------------------------------

const ALLOW_PRIVATE_CHAT =
	String(process.env.ALPHA_PRIVATE_CHAT || "false").toLowerCase() === "true";

// -------------------------------------------------------------------------------------------------------------
// NVIDIA GENERATION CONFIG
// -------------------------------------------------------------------------------------------------------------//

const generationConfig = {
	temperature: 0.8,
	topP: 0.95,
	maxTokens: 650,
};

// -------------------------------------------------------------------------------------------------------------
// ALPHA SYSTEM PROMPT
// -------------------------------------------------------------------------------------------------------------//

const alphaSystemPrompt = `
You are ⚡Alpha⚡, a confident, witty and natural WhatsApp AI assistant.

Your personality:
- Confident
- Witty
- Direct
- Friendly
- Natural
- Smart
- Helpful without sounding robotic

How you communicate:
- Talk naturally like someone having a real WhatsApp conversation.
- Do not sound like a corporate chatbot.
- Do not over-explain simple questions.
- Give detailed explanations when the user actually needs them.
- You can use casual expressions such as "yeah", "nah", "lol", "fr", "tbh", "ngl", "gonna", and "wanna" when they naturally fit.
- Match the user's tone without becoming unnecessarily disrespectful.
- Do not force jokes.
- Do not pretend to be human.
- Do not narrate physical actions such as *laughs* or *smiles*.
- Do not constantly mention that you are an AI.

Emoji rule:
- Do not spam emojis.
- The name ⚡Alpha⚡ may be used when identifying yourself.
- Otherwise use emojis only when they genuinely fit the conversation.

Language:
- Reply in the language the user uses.
- If the user uses Hinglish, naturally respond in Hinglish.
- Match the user's general language style.

Formatting:
- Do NOT use markdown headers such as #, ## or ###.
- Use *single asterisks* for bold text.
- Use hyphens (-) for lists.
- Do not use code blocks unless the user specifically asks for code.
- Keep responses clean and readable on WhatsApp.

You are ⚡Alpha⚡.
`;

// -------------------------------------------------------------------------------------------------------------
// GROUP ASSISTANT SYSTEM PROMPT
// -------------------------------------------------------------------------------------------------------------//

const groupAssistantSystemPrompt = `
You are ⚡Alpha⚡, the AI group assistant for a WhatsApp group.

You have access to information about the group and recent conversation history.

Your job is to help members understand what is happening in the group.

Summarizing:
- Do not give a message-by-message breakdown.
- Identify the important topics.
- Group information into:
  * Main Topics
  * Decisions Made
  * Action Items
- Keep summaries concise and useful.

Answering questions:
- Use the information supplied in the group context.
- If a member asks about a specific detail, past decision, or who mentioned something, answer directly.
- Do not invent messages, events, members, decisions, warnings, or facts.
- If the requested information is not available, clearly say that you do not have enough information.

Group awareness:
- Understand that the supplied group information belongs ONLY to the current WhatsApp group.
- Never treat information from one group as information from another group.
- Never claim that a group is activated unless the bot data explicitly says the chatbot is active.
- Do not reveal private internal configuration unnecessarily.

Formatting:
- Use *single asterisks* for bold text.
- Use hyphens (-) for bullet points.
- NEVER use markdown headers such as #, ## or ###.
- NEVER use code blocks unless the user specifically asks for code.
- Keep responses clean and mobile-friendly.

You are ⚡Alpha⚡.
`;

// -------------------------------------------------------------------------------------------------------------
// NVIDIA API FUNCTION
// -------------------------------------------------------------------------------------------------------------//

async function askNvidia(systemPrompt, messages) {
	if (!NVIDIA_API_KEY) {
		throw new Error("NVIDIA_API_KEY is not configured.");
	}

	const response = await fetch(
		`${NVIDIA_BASE_URL}/chat/completions`,
		{
			method: "POST",

			headers: {
				Authorization: `Bearer ${NVIDIA_API_KEY}`,
				"Content-Type": "application/json",
				Accept: "application/json",
			},

			body: JSON.stringify({
				model: NVIDIA_MODEL,

				messages: [
					{
						role: "system",
						content: systemPrompt,
					},
					...messages,
				],

				temperature: generationConfig.temperature,
				top_p: generationConfig.topP,
				max_tokens: generationConfig.maxTokens,

				stream: false,
			}),
		}
	);

	if (!response.ok) {
		const errorText = await response.text();

		throw new Error(
			`NVIDIA API Error ${response.status}: ${errorText}`
		);
	}

	const result = await response.json();

	const text =
		result?.choices?.[0]?.message?.content?.trim() || "";

	if (!text) {
		throw new Error("NVIDIA returned an empty response.");
	}

	return text;
}

// -------------------------------------------------------------------------------------------------------------
// CONVERT STORED HISTORY TO NVIDIA FORMAT
// -------------------------------------------------------------------------------------------------------------//

function convertConversationHistory(conversationHistory = []) {
	return conversationHistory
		.map((message) => {
			let role = message?.role;

			// Old Gemini history uses "model".
			// NVIDIA/OpenAI-compatible API uses "assistant".
			if (role === "model") {
				role = "assistant";
			}

			if (role !== "user" && role !== "assistant") {
				return null;
			}

			const content =
				message?.parts
					?.map((part) => part?.text || "")
					.join("\n")
					.trim() || "";

			if (!content) {
				return null;
			}

			return {
				role,
				content,
			};
		})
		.filter(Boolean);
}

// -------------------------------------------------------------------------------------------------------------
// MAIN ALPHA CHAT FUNCTION
// -------------------------------------------------------------------------------------------------------------//

async function chat(
	prompt,
	from,
	msg,
	taggedMember,
	msgInfoObj,
	data,
	tagMessage,
	tagMessageSenderJID,
	chatContext = ""
) {
	const {
		sendMessageWTyping,
		command,
		updateName,
		updateId,
		senderJid,
		groupMetadata,
		groupAdmins,
		isGroup,
	} = msgInfoObj;

	try {
		// -----------------------------------------------------------------------------------------
		// Get member information
		// -----------------------------------------------------------------------------------------

		let memberData = null;

		try {
			memberData = await getMemberData(senderJid);
		} catch (memberError) {
			console.error(
				"Alpha member-data error:",
				memberError
			);
		}

		// -----------------------------------------------------------------------------------------
		// Reply information
		// -----------------------------------------------------------------------------------------

		let replyInfo = "";

		if (tagMessage && tagMessageSenderJID) {
			try {
				const tagMessageSender =
					await getMemberData(
						tagMessageSenderJID
					);

				const replySenderName =
					tagMessageSender?.username ||
					extractPhoneNumber(
						tagMessageSenderJID
					);

				const replyContent =
					JSON.stringify(tagMessage);

				replyInfo =
					`\n(Replying to ${replySenderName}: ${replyContent})`;
			} catch (replyError) {
				console.error(
					"Alpha reply-context error:",
					replyError
				);
			}
		}

		// -----------------------------------------------------------------------------------------
		// Get conversation history
		// -----------------------------------------------------------------------------------------

		let conversationHistory = [];

		if (isGroup && data?.chatHistory) {
			conversationHistory =
				data.chatHistory
					.slice(-10)
					.map((historyMessage) => ({
						role: historyMessage.role,
						parts: historyMessage.parts,
					}));
		}

		const historyMessages =
			convertConversationHistory(
				conversationHistory
			);

		// -----------------------------------------------------------------------------------------
		// Select Alpha mode
		// -----------------------------------------------------------------------------------------

		const isGroupAssistant =
			command === "gemini";

		const systemPrompt =
			isGroupAssistant
				? groupAssistantSystemPrompt
				: alphaSystemPrompt;

		// -----------------------------------------------------------------------------------------
		// Build user's prompt
		// -----------------------------------------------------------------------------------------

		let fullPrompt =
			`[${updateName || "Unknown User"}]: ${prompt}${replyInfo}`;

		// -----------------------------------------------------------------------------------------
		// Add group information
		// -----------------------------------------------------------------------------------------

		if (
			isGroupAssistant &&
			isGroup &&
			data
		) {
			const admins =
				groupAdmins
					?.map((admin) => {
						const adminData =
							data?.members?.find(
								(member) =>
									member.id ===
									admin
							);

						return (
							adminData?.name ||
							admin.split("@")[0]
						);
					})
					.join(", ") ||
				"Unknown";

			const groupInfo = `
--- Group Information ---

Group Name: ${data?.grpName || "Unknown"}

Group ID: ${data?._id || "Unknown"}

Group Description: ${data?.desc || "No description"}

Total Messages: ${data?.totalMsgCount || 0}

Bot Status: ${
				data?.isBotOn
					? "Active"
					: "Inactive"
			}

ChatBot Status: ${
				data?.isChatBotOn
					? "Active"
					: "Inactive"
			}

Total Members: ${
				data?.members?.length || 0
			}

Group Admins: ${admins}

Blocked Commands: ${
				data?.cmdBlocked?.join(", ") ||
				"None"
			}

Welcome Message Enabled: ${
				data?.welcome?.status
					? "Yes"
					: "No"
			}

Member Warnings: ${
				JSON.stringify(
					data?.memberWarnCount
				) || "None"
			}

--- Current User Information ---

User Name: ${updateName || "Unknown"}

User ID: ${updateId || "Unknown"}

User WhatsApp JID: ${
				senderJid || "Unknown"
			}

User Total Messages: ${
				memberData?.totalmsg || 0
			}

Is Admin: ${
				groupAdmins?.includes(
					senderJid
				)
					? "Yes"
					: "No"
			}

-------------------------
`;

			const chatSection = chatContext
				? `
--- Recent Group Chat ---

${chatContext}

--- End of Recent Group Chat ---

`
				: "";

			fullPrompt =
				groupInfo +
				chatSection +
				fullPrompt;
		}

		// -----------------------------------------------------------------------------------------
		// Send request to NVIDIA
		// -----------------------------------------------------------------------------------------

		const messages = [
			...historyMessages,
			{
				role: "user",
				content: fullPrompt,
			},
		];

		const text = await askNvidia(
			systemPrompt,
			messages
		);

		// -----------------------------------------------------------------------------------------
		// Empty response protection
		// -----------------------------------------------------------------------------------------

		if (!text?.trim()) {
			return sendMessageWTyping(
				from,
				{
					text:
						"Sorry, I didn't understand that. Can you rephrase it?",
				},
				{
					quoted: msg,
				}
			);
		}

		// -----------------------------------------------------------------------------------------
		// Save conversation history
		// -----------------------------------------------------------------------------------------

		if (isGroup && data) {
			const newHistory = [
				...(data?.chatHistory || []),

				{
					role: "user",
					parts: [
						{
							text: fullPrompt,
						},
					],
					senderName:
						updateName || "Unknown User",
					senderJid: senderJid,
					timestamp:
						new Date().toISOString(),
				},

				{
					role: "model",
					parts: [
						{
							text: text.trim(),
						},
					],
					senderName: "⚡Alpha⚡",
					timestamp:
						new Date().toISOString(),
				},
			];

			const trimmedHistory =
				newHistory.slice(
					-MAX_HISTORY_MESSAGES
				);

			await group.updateOne(
				{ _id: from },
				{
					$set: {
						chatHistory:
							trimmedHistory,
					},
				}
			);
		}

		// -----------------------------------------------------------------------------------------
		// Send Alpha response
		// -----------------------------------------------------------------------------------------

		return sendMessageWTyping(
			from,
			{
				text:
					"⚡Alpha⚡\n" +
					text.trim(),
			},
			{
				quoted: msg,
			}
		);
	} catch (err) {
		console.error(
			"⚡Alpha⚡ NVIDIA error:",
			err
		);

		return sendMessageWTyping(
			from,
			{
				text:
					"⚡Alpha⚡ is having trouble connecting to the AI right now. Try again in a moment.",
			},
			{
				quoted: msg,
			}
		);
	}
}

// -------------------------------------------------------------------------------------------------------------
// COMMAND HANDLER
// -------------------------------------------------------------------------------------------------------------//

const handler = async (
	sock,
	msg,
	from,
	args,
	msgInfoObj
) => {
	const {
		sendMessageWTyping,
		isGroup,
		evv,
		extendedMessageOriginal,
	} = msgInfoObj;

	// ---------------------------------------------------------------------------------------------
	// NVIDIA API KEY CHECK
	// ---------------------------------------------------------------------------------------------

	if (!NVIDIA_API_KEY) {
		return sendMessageWTyping(
			from,
			{
				text:
					"⚡Alpha⚡ AI is not configured yet. NVIDIA_API_KEY is missing.",
			},
			{
				quoted: msg,
			}
		);
	}

	// ---------------------------------------------------------------------------------------------
	// Empty message
	// ---------------------------------------------------------------------------------------------

	if (!evv?.trim()) {
		return sendMessageWTyping(
			from,
			{
				text:
					"⚡Alpha⚡ is listening. Enter some text.",
			},
			{
				quoted: msg,
			}
		);
	}

	// ---------------------------------------------------------------------------------------------
	// Input length protection
	// ---------------------------------------------------------------------------------------------

	const wordCount =
		evv.trim().split(/\s+/).length;

	if (wordCount > MAX_INPUT_WORDS) {
		return sendMessageWTyping(
			from,
			{
				text:
					`⚠️ Message too long!\n\n` +
					`Your message: ${wordCount} words\n` +
					`Limit: ${MAX_INPUT_WORDS} words`,
			},
			{
				quoted: msg,
			}
		);
	}

	// ---------------------------------------------------------------------------------------------
	// Reply / mention information
	// ---------------------------------------------------------------------------------------------

	let taggedMember;
	let tagMessage;
	let tagMessageSenderJID;

	if (extendedMessageOriginal) {
		tagMessage =
			extendedMessageOriginal.quotedMessage;

		tagMessageSenderJID =
			extendedMessageOriginal.participant;

		if (
			extendedMessageOriginal
				?.mentionedJid?.length > 0
		) {
			taggedMember =
				extendedMessageOriginal.mentionedJid;
		}
	}

	const prompt = evv;

	// =============================================================================================
	// GROUP CHAT
	// =============================================================================================

	if (isGroup) {
		const data =
			await getGroupData(from);

		// -----------------------------------------------------------------------------------------
		// IMPORTANT:
		// Every WhatsApp group has its own "from" ID.
		//
		// Therefore Alpha checks the chatbot setting for THIS exact group.
		// Activating Alpha in Group A does NOT activate it in Group B.
		// -----------------------------------------------------------------------------------------

		if (!data) {
			return sendMessageWTyping(
				from,
				{
					text:
						"⚡Alpha⚡ isn't activated in this group yet.",
				},
				{
					quoted: msg,
				}
			);
		}

		if (data.isChatBotOn !== true) {
			return sendMessageWTyping(
				from,
				{
					text:
						"⚡Alpha⚡ is currently turned off in this group.",
				},
				{
					quoted: msg,
				}
			);
		}

		// -----------------------------------------------------------------------------------------
		// Get recent group chat context
		// -----------------------------------------------------------------------------------------

		let chatContext = "";

		if (msgInfoObj.command === "gemini") {
			try {
				const logs =
					await getChatMessages(
						from,
						24
					);

				if (logs?.length > 0) {
					chatContext =
						logs
							.slice(-100)
							.map((m) => {
								const name =
									m.senderName ||
									m.sender
										?.split(
											"@"
										)[0] ||
									"Unknown";

								const replyPart =
									m.replyTo
										? ` [replying to ${
												m
													.replyTo
													.senderName ||
												m
													.replyTo
													.sender
													?.split(
														"@"
													)[0] ||
												"Unknown"
										  }: "${
												m
													.replyTo
													.text ||
												""
										  }"]`
										: "";

								let text =
									m.text ||
									"";

								// Replace raw mentions with names.
								if (
									m.mentions
										?.length >
									0
								) {
									for (const mention of m.mentions) {
										if (
											!mention
												?.jid
										) {
											continue;
										}

										const num =
											mention.jid
												.split(
													"@"
												)[0]
												.split(
													":"
												)[0];

										if (
											mention.name
										) {
											text =
												text.replace(
													new RegExp(
														`@${num}`,
														"g"
													),
													`@${mention.name}`
												);
										}
									}
								}

								return `${name}${replyPart}: ${text}`;
							})
							.join("\n");
				}
			} catch (contextError) {
				console.error(
					"Alpha chat-context error:",
					contextError
				);
			}
		}

		return chat(
			prompt,
			from,
			msg,
			taggedMember,
			msgInfoObj,
			data,
			tagMessage,
			tagMessageSenderJID,
			chatContext
		);
	}

	// =============================================================================================
	// PRIVATE CHAT
	// =============================================================================================

	/*
	 * IMPORTANT:
	 *
	 * Your old code did this:
	 *
	 * if (msgInfoObj.isOwner) {
	 *     chat(...)
	 * } else {
	 *     reject
	 * }
	 *
	 * That means EVERY private chat from a non-owner was rejected.
	 *
	 * Now private chat behavior is controlled by ALPHA_PRIVATE_CHAT.
	 */

	if (ALLOW_PRIVATE_CHAT) {
		return chat(
			prompt,
			from,
			msg,
			taggedMember,
			msgInfoObj,
			null,
			tagMessage,
			tagMessageSenderJID
		);
	}

	// If private chat is disabled, only the owner can use Alpha privately.
	if (msgInfoObj.isOwner) {
		return chat(
			prompt,
			from,
			msg,
			taggedMember,
			msgInfoObj,
			null,
			tagMessage,
			tagMessageSenderJID
		);
	}

	return sendMessageWTyping(
		from,
		{
			text:
				"⚡Alpha⚡ is currently available in activated groups only.",
		},
		{
			quoted: msg,
		}
	);
};

// -------------------------------------------------------------------------------------------------------------
// EXPORT
// -------------------------------------------------------------------------------------------------------------//

export default () => ({
	// New preferred command:
	// alpha
	//
	// Kept eva and gemini as aliases so your existing command
	// system does not suddenly break.
	cmd: ["alpha", "eva", "gemini"],

	desc: "Chat with ⚡Alpha⚡ using NVIDIA AI",

	usage: "alpha <text>",

	handler,
});
