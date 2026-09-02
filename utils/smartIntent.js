const clean = (value) => String(value || "").replace(/@[0-9]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
const stripLead = (text, pattern) => clean(text.replace(pattern, ""));

const LANGUAGE_CODES = {
	english:"en",french:"fr",spanish:"es",german:"de",arabic:"ar",chinese:"zh",japanese:"ja",korean:"ko",portuguese:"pt",russian:"ru",italian:"it",turkish:"tr",hindi:"hi",yoruba:"yo",igbo:"ig",hausa:"ha",
};

export const SMART_INTENT_EXAMPLES = [
	"send me Asake - Forgiveness", "get the lyrics for Wizkid - Essence", "show me Burna Boy music video",
	"find a funny reaction GIF", "send an African classroom photo", "play an applause sound effect",
	"weather in Lagos", "calculate 25 * 8", "translate to French good morning",
	"remind me in 2h to call Tunde", "search Wikipedia for Nigerian history", "show my rank",
];

export const detectSmartIntent = (rawText, { isGroup = false } = {}) => {
	const text = clean(rawText);
	if (!text || text.length < 3) return null;

	let match = text.match(/^(?:please\s+)?(?:send|show|get|find|download|play)?\s*(?:me\s+)?(?:the\s+)?(?:official\s+)?music\s+video(?:\s+(?:for|of|by))?\s+(.+)$/i);
	if (match) return { command: "video", args: clean(match[1]).split(/\s+/), label: "music video" };
	match = text.match(/^(?:please\s+)?(?:send|show|get|find|download|play)\s+(?:me\s+)?(.+?)\s+(?:official\s+)?music\s+video$/i);
	if (match) return { command: "video", args: clean(match[1]).split(/\s+/), label: "music video" };
	match = text.match(/^(?:please\s+)?(?:send|show|get|find)?\s*(?:me\s+)?(?:the\s+)?lyrics(?:\s+(?:for|of|to))?\s+(.+)$/i);
	if (match) return { command: "lyrics", args: clean(match[1]).split(/\s+/), label: "lyrics" };
	match = text.match(/^(?:please\s+)?(?:send|download|play|get|find)\s+(?:me\s+)?(?:the\s+)?(?:song|music|audio|mp3)(?:\s+(?:for|of|by))?\s+(.+)$/i);
	if (match) return { command: /\b(?:file|document)\b/i.test(text) ? "musicfile" : "music", args: clean(match[1]).replace(/\s+(?:as\s+)?(?:a\s+)?(?:file|document)$/i, "").split(/\s+/), label: "music" };
	match = text.match(/^(?:please\s+)?(?:send|download|play|get|find)\s+(?:me\s+)?(.+\s+-\s+.+)$/i);
	if (match) return { command: "music", args: clean(match[1]).split(/\s+/), label: "music" };
	match = text.match(/^(?:please\s+)?(?:send|download|show|get|find)\s+(?:me\s+)?(?:a\s+)?video(?:\s+(?:for|of|about))?\s+(.+)$/i);
	if (match) return { command: /\b(?:file|document)\b/i.test(text) ? "videofile" : "video", args: clean(match[1]).replace(/\s+(?:as\s+)?(?:a\s+)?(?:file|document)$/i, "").split(/\s+/), label: "video" };
	match = text.match(/^(?:please\s+)?(?:send|show|find|get)\s+(?:me\s+)?(?:a\s+)?(?:reaction\s+)?gif(?:\s+(?:for|of|about))?\s*(.*)$/i);
	if (match) return { command: "gifsearch", args: clean(match[1] || "funny reaction").split(/\s+/), label: "GIF" };
	match = text.match(/^(?:please\s+)?(?:send|show|find|get)\s+(?:me\s+)?(?:an?\s+)?(?:photo|image|picture)(?:\s+(?:of|about|for))?\s+(.+)$/i);
	if (match) return { command: "freeimage", args: clean(match[1]).split(/\s+/), label: "image" };
	match = text.match(/^(?:please\s+)?(?:send|play|find|get)\s+(?:me\s+)?(?:an?\s+)?sound(?:\s+effect)?(?:\s+(?:of|for))?\s+(.+)$/i);
	if (match) return { command: "soundsearch", args: clean(match[1]).split(/\s+/), label: "sound effect" };

	match = text.match(/^(?:what(?:'s|\s+is)\s+the\s+)?weather(?:\s+(?:in|for|at))\s+(.+)$/i);
	if (match) return { command: "weather", args: clean(match[1]).split(/\s+/), label: "weather" };
	match = text.match(/^(?:calculate|compute|solve)\s+(.+)$/i);
	if (match) return { command: "calc", args: clean(match[1]).split(/\s+/), label: "calculation" };
	match = text.match(/^translate(?:\s+this)?\s+(?:to|into)\s+([a-z]+)\s+(.+)$/i);
	if (match) return { command: "translate", args: [LANGUAGE_CODES[match[1].toLowerCase()] || match[1].toLowerCase(), ...clean(match[2]).split(/\s+/)], label: "translation" };
	match = text.match(/^remind\s+(?:me|us)?\s*(?:in|at)?\s*(\d+[mhdw]|\d{1,2}(?::\d{2})?(?:am|pm)|\d{1,2}:\d{2})\s+(?:to\s+)?(.+)$/i);
	if (match) return { command: "remind", args: [match[1], ...clean(match[2]).split(/\s+/)], label: "reminder" };
	match = text.match(/^(?:search|look\s+up|find)\s+(?:wikipedia|wiki)\s+(?:for\s+)?(.+)$/i);
	if (match) return { command: "wiki", args: clean(match[1]).split(/\s+/), label: "Wikipedia" };
	match = text.match(/^(?:search|google|look\s+up)\s+(?:for\s+)?(.+)$/i);
	if (match) return { command: "search", args: clean(match[1]).split(/\s+/), label: "web search" };
	if (/^(?:show|get|what(?:'s|\s+is))\s+(?:me\s+)?my\s+(?:rank|level|xp)$/i.test(text)) return { command: "rank", args: [], label: "rank" };
	if (/^(?:show|open|send)\s+(?:me\s+)?(?:the\s+)?(?:help|commands|menu)$/i.test(text)) return { command: "smarthelp", args: [], label: "help" };

	if (isGroup) {
		match = text.match(/^(?:start|play)\s+(trivia|math\s+game|scramble|riddle|tic\s*tac\s*toe|connect\s*four)$/i);
		if (match) {
			const routes = { trivia:"trivia", "math game":"mathgame", scramble:"scramble", riddle:"riddle", "tic tac toe":"ttt", "connect four":"connect4" };
			return { command: routes[match[1].toLowerCase().replace(/\s+/g," ")], args: [], label: "game", groupOnly: true };
		}
		match = text.match(/^create\s+(?:a\s+)?poll\s+(.+)$/i);
		if (match) return { command: "poll", args: clean(match[1]).split(/\s+/), label: "poll", groupOnly: true };
		if (/^show\s+(?:the\s+)?(?:game\s+)?leaderboard$/i.test(text)) return { command: "gameboard", args: [], label: "leaderboard", groupOnly: true };
	}
	return null;
};

export const smartIntentSummary = () => ({
	media: ["music", "lyrics", "music videos", "videos", "GIFs", "images", "sound effects"],
	utilities: ["weather", "calculation", "translation", "reminders", "Wikipedia", "web search", "rank"],
	groups: ["polls", "trivia", "math games", "scramble", "riddles", "tic-tac-toe", "Connect Four", "leaderboards"],
});
