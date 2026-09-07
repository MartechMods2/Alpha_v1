const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const editDistance = (a, b) => {
	const left = normalize(a), right = normalize(b);
	const row = Array.from({ length: right.length + 1 }, (_, index) => index);
	for (let i = 1; i <= left.length; i++) {
		let previous = row[0]; row[0] = i;
		for (let j = 1; j <= right.length; j++) {
			const saved = row[j];
			row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
			previous = saved;
		}
	}
	return row[right.length];
};

export const searchCommands = (commands, query, limit = 8) => {
	const needle = normalize(query);
	if (!needle) return [];
	return commands.map((entry) => {
		const aliases = entry.cmd || [];
		const haystack = normalize(`${aliases.join(" ")} ${entry.desc || ""} ${entry.usage || ""}`);
		const exact = aliases.some((alias) => normalize(alias) === needle);
		const contains = haystack.includes(needle);
		const distance = Math.min(...aliases.map((alias) => editDistance(alias, needle)), 99);
		return { ...entry, score: exact ? -100 : contains ? -20 : distance };
	}).filter((entry) => entry.score <= Math.max(3, Math.ceil(needle.length * 0.45)) || entry.score < 0)
		.sort((a, b) => a.score - b.score || a.cmd[0].localeCompare(b.cmd[0])).slice(0, limit);
};
