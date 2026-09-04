const normalize = (value = "") => String(value).toLowerCase().replace(/[!?.,]+/g, " ").replace(/\s+/g, " ").trim();

const rules = [
	{ command: "tagall", test: /^(?:please )?(?:i want you to )?(?:mention|tag) (?:all|everyone|all (?:the )?members|every member)(?: in (?:this|the) group)?$/ },
	{ command: "admin", test: /^(?:please )?(?:show|list) (?:the )?(?:admins|group admins)$/ },
	{ command: "mutelist", test: /^(?:please )?(?:show|list) (?:the )?(?:muted members|mute list)$/ },
	{ command: "birthday", args: ["list"], test: /^(?:please )?(?:show|list) (?:the )?(?:birthdays|birthday list)$/ },
	{ command: "birthdayauto", args: ["on"], test: /^(?:please )?(?:enable|turn on) (?:automatic )?birthday greetings$/ },
	{ command: "groupstats", test: /^(?:please )?(?:show|give me) (?:the )?group stats(?:istics)?$/ },
	{ command: "safekalihelp", test: /^(?:please )?(?:show|open) (?:the )?(?:security|safe kali) tools$/ },
];

export const detectOwnerIntent = (text) => {
	const normalized = normalize(text);
	if (!normalized || normalized.length > 160) return null;
	const rule = rules.find((candidate) => candidate.test.test(normalized));
	return rule ? { command: rule.command, args: rule.args || [], normalized } : null;
};

export const isMartechOwner = (phone) => {
	const configured = String(process.env.MARTECH_OWNER_NUMBER || "2348140893169").replace(/\D/g, "");
	return Boolean(configured && String(phone || "").replace(/\D/g, "") === configured);
};

export const ownerIntentPhrases = () => rules.map(({ command }) => command);

const executions = new Map();
export const consumeOwnerIntentCooldown = (owner, command) => {
	const now = Date.now();
	const key = `${owner}:${command}`;
	const wait = command === "tagall" ? 30 * 60_000 : 10_000;
	if ((executions.get(key) || 0) > now) return false;
	executions.set(key, now + wait);
	return true;
};
