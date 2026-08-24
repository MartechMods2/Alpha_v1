export const cleanGroupToolText = (value, limit = 200) =>
	String(value || "")
		.replace(/[\u0000-\u001f\u007f]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, limit);

export const parseBirthday = (value) => {
	const match = String(value || "").trim().match(/^(\d{1,2})[\/-](\d{1,2})$/);
	if (!match) return null;
	const day = Number(match[1]);
	const month = Number(match[2]);
	const probe = new Date(Date.UTC(2024, month - 1, day));
	if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
	return { day, month };
};

export const daysUntilBirthday = ({ day, month }, now = new Date()) => {
	const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	let target = new Date(Date.UTC(today.getUTCFullYear(), month - 1, day));
	if (target < today) target = new Date(Date.UTC(today.getUTCFullYear() + 1, month - 1, day));
	return Math.round((target - today) / 86_400_000);
};

export const parseCountdownDate = (value) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};
