export const localClock = (date = new Date(), timezone = process.env.BOT_TIMEZONE || "Africa/Lagos") => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
	return {
		dateKey: `${parts.year}-${parts.month}-${parts.day}`,
		time: `${parts.hour}:${parts.minute}`,
		day: Number(parts.day),
		month: Number(parts.month),
	};
};

export const daysBetweenDateKeys = (fromKey, toKey) => {
	const from = Date.parse(`${fromKey}T00:00:00Z`);
	const to = Date.parse(`${toKey}T00:00:00Z`);
	if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.NaN;
	return Math.round((to - from) / 86_400_000);
};
