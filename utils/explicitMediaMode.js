export const AI_IMAGE_COMMANDS = Object.freeze(["img", "imagegen", "drawai", "aipicture"]);
export const AI_VOICE_COMMANDS = Object.freeze(["voice", "voiceask", "askvoice", "aivoice", "vnote"]);
export const RAW_TTS_COMMANDS = Object.freeze(["say", "speak", "tts"]);
export const MEDIA_HELP_COMMANDS = Object.freeze(["aimedia", "mediaai", "aimediahelp"]);

export const classifyAlphaMediaCommand = (command) => {
	const value = String(command || "").toLowerCase();
	if (AI_IMAGE_COMMANDS.includes(value)) return "image";
	if (AI_VOICE_COMMANDS.includes(value)) return "voice-ai";
	if (RAW_TTS_COMMANDS.includes(value)) return "voice-tts";
	if (MEDIA_HELP_COMMANDS.includes(value)) return "help";
	return "unknown";
};

export const quotedMediaText = (context = {}) => {
	const q = context?.quotedMessage || {};
	return String(
		q.conversation ??
		q.extendedTextMessage?.text ??
		q.imageMessage?.caption ??
		q.videoMessage?.caption ??
		q.documentMessage?.caption ??
		"",
	).trim();
};

export const resolveExplicitMediaPrompt = (args = [], context = {}) =>
	(String(Array.isArray(args) ? args.join(" ") : args).trim() || quotedMediaText(context)).trim();
