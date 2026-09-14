const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

const candidates = (text) => {
	const found = [];
	const add = (mode, action, regexes) => {
		for (const regex of regexes) {
			const match = regex.exec(text);
			if (match) found.push({ mode, action, index: match.index, matched: match[0] });
		}
	};

	add("voice", "speak", [
		/\b(?:using|with|by|in|through|as)\s+(?:a\s+)?(?:voice(?:\s+(?:note|message))?|audio(?:\s+message)?)\b/i,
		/\b(?:reply|answer|respond|explain|tell\s+me)\s+(?:to\s+me\s+)?(?:in|with|by|as)\s+(?:a\s+)?(?:voice(?:\s+(?:note|message))?|audio(?:\s+message)?)\b/i,
		/\b(?:send|give)\s+(?:me\s+)?(?:the\s+answer\s+)?(?:as\s+)?(?:a\s+)?(?:voice(?:\s+(?:note|message))?|audio(?:\s+message)?)\b/i,
		/\b(?:say|speak|read)\s+(?:the\s+)?(?:answer|response|reply)(?:\s+out\s+loud)?\b/i,
		/\b(?:say|speak)\s+(?:it|this)\s+(?:out\s+loud|to\s+me)\b/i,
	]);
	add("image", "generate", [
		/\b(?:generate|create|draw|make|design|render)\s+(?:me\s+)?(?:an?\s+)?(?:ai\s+)?(?:image|picture|illustration|photo)\b/i,
		/\b(?:show|send|give)\s+(?:me\s+)?(?:an?\s+)?(?:ai\s+)?(?:image|picture|illustration|photo)\b/i,
		/\b(?:as|using|with|in)\s+(?:an?\s+)?(?:ai\s+)?(?:image|picture|illustration|photo)\b/i,
	]);
	add("image", "search", [
		/\b(?:find|search(?:\s+for)?|look\s+up|get)\s+(?:me\s+)?(?:an?\s+)?(?:real\s+|stock\s+)?(?:photo|image|picture)\b/i,
	]);
	add("video", "search", [
		/\b(?:show|find|send|get|give|play|search(?:\s+for)?)\s+(?:me\s+)?(?:an?\s+)?videos?\b/i,
		/\b(?:using|with|by|in)\s+(?:(?:a|some)\s+)?videos?\b/i,
		/\b(?:answer|explain|teach|show)\s+(?:me\s+)?(?:this\s+)?(?:in|with|by)\s+(?:(?:a|some)\s+)?videos?\b/i,
	]);
	add("video", "generate", [
		/\b(?:generate|create|make|render)\s+(?:me\s+)?(?:an?\s+)?(?:ai\s+)?video\b/i,
	]);
	add("text", "text", [
		/\b(?:as|using|with|in)\s+(?:plain\s+)?text\b/i,
		/\b(?:reply|answer|respond)\s+(?:in|with|as)\s+text\b/i,
	]);
	return found;
};

const stripKnownPhrases = (text) => clean(text
	.replace(/^\s*@alpha\b[:,]?\s*/i, " ")
	.replace(/^\s*alpha\b[:,]?\s*/i, " ")
	.replace(/\b(?:using|with|by|in|through|as)\s+(?:a\s+)?(?:voice(?:\s+(?:note|message))?|audio(?:\s+message)?)\b/gi, " ")
	.replace(/\b(?:as|using|with|in)\s+(?:plain\s+)?text\b/gi, " ")
	.replace(/\b(?:as|using|with|in)\s+(?:an?\s+)?(?:ai\s+)?(?:image|picture|illustration|photo)\b/gi, " ")
	.replace(/\b(?:using|with|by|in)\s+(?:(?:a|some)\s+)?videos?\b/gi, " ")
	.replace(/^\s*(?:please\s+)?(?:generate|create|draw|make|design|render|show|find|search(?:\s+for)?|send|get|give|play)\s+(?:me\s+)?(?:an?\s+)?(?:ai\s+)?(?:image|picture|illustration|photo|videos?)(?:\s+(?:of|about|for))?\s*/i, " ")
	.replace(/^\s*(?:please\s+)?(?:reply|answer|respond|explain|tell\s+me)\s+(?:to\s+me\s+)?(?:in|with|by|as)\s+(?:a\s+)?(?:voice(?:\s+(?:note|message))?|audio(?:\s+message)?|text)\s*/i, " "));

export const detectAlphaDeliveryIntent = (rawText) => {
	const text = clean(rawText).slice(0, 5000);
	if (!text) return { mode: "text", action: "text", explicit: false, prompt: "", original: "" };
	const choices = candidates(text);
	if (!choices.length) return { mode: "text", action: "text", explicit: false, prompt: text, original: text };
	// The last explicit delivery instruction wins. Alpha never chooses media just
	// because media could be useful; text remains the default unless requested.
	const selected = choices.sort((a, b) => a.index - b.index).at(-1);
	return {
		mode: selected.mode,
		action: selected.action,
		explicit: true,
		prompt: stripKnownPhrases(text) || text,
		original: text,
	};
};

export const alphaDeliveryDefaults = () => ({
	defaultMode: "text",
	explicitModes: ["text", "voice", "image", "video"],
});
