const COOKIE_HEADERS = new Set(["# Netscape HTTP Cookie File", "# HTTP Cookie File"]);
const ALLOWED_COOKIE_DOMAINS = ["youtube.com", "google.com", "googlevideo.com", "youtu.be"];

const domainAllowed = (domain) => {
	const normalized = String(domain || "")
		.replace(/^#HttpOnly_/, "")
		.replace(/^\./, "")
		.toLowerCase();
	return ALLOWED_COOKIE_DOMAINS.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
};

/** Validate, minimize and normalize a Netscape cookies.txt export. */
export function normalizeCookies(content) {
	const normalized = String(content || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
	if (!normalized) return { valid: false, reason: "No cookies were supplied", content: "", count: 0 };
	const lines = normalized.split("\n");
	const firstIndex = lines.findIndex((line) => line.trim());
	const firstMeaningful = firstIndex >= 0 ? lines[firstIndex].trim() : "";
	if (!COOKIE_HEADERS.has(firstMeaningful)) {
		return {
			valid: false,
			reason: "The first line must be # Netscape HTTP Cookie File",
			content: "",
			count: 0,
		};
	}

	const cookieLines = [];
	for (const rawLine of lines.slice(firstIndex + 1)) {
		const line = rawLine.trimEnd();
		if (!line.trim() || (line.trimStart().startsWith("#") && !line.trimStart().startsWith("#HttpOnly_"))) continue;
		const fields = line.split("\t");
		if (fields.length !== 7 || !domainAllowed(fields[0])) continue;
		cookieLines.push(fields.join("\t"));
	}

	if (!cookieLines.length) {
		return {
			valid: false,
			reason: "No valid YouTube/Google cookie rows were found",
			content: "",
			count: 0,
		};
	}

	return {
		valid: true,
		reason: "",
		content: `# Netscape HTTP Cookie File\n${cookieLines.join("\n")}\n`,
		count: cookieLines.length,
	};
}
