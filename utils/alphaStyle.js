const cleanLine = (value) => String(value ?? "").replace(/\r/g, "").trim();

export const alphaPanel = ({ icon = "⚡", title = "Alpha", lines = [], footer = "" } = {}) => {
	const body = (Array.isArray(lines) ? lines : [lines])
		.map(cleanLine)
		.filter(Boolean)
		.map((line) => `│ ${line}`)
		.join("\n");
	const tail = cleanLine(footer);
	return [
		`╭─ ${icon} *${cleanLine(title) || "Alpha"}*`,
		body,
		tail ? `│\n│ ${tail}` : "",
		"╰──────────────────",
	].filter(Boolean).join("\n");
};

export const alphaDivider = (label = "") => label ? `── ${cleanLine(label)} ──` : "────────────────────";

export const safeDisplayName = (value, jid = "") =>
	String(value || String(jid).split("@")[0] || "Member")
		.replace(/[\r\n\t*_~`]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 60);
