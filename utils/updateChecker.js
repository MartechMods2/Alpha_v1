const repository = process.env.UPDATE_REPOSITORY || "MartechMods2/Alpha_v1";

export const checkForUpdate = async () => {
	const current = String(process.env.RENDER_GIT_COMMIT || process.env.BOT_BUILD_SHA || "").trim();
	const response = await fetch(`https://api.github.com/repos/${repository}/commits/main`, {
		headers: { Accept: "application/vnd.github+json", "User-Agent": "Alpha-Update-Checker" },
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
	const latest = await response.json();
	const latestSha = String(latest?.sha || "");
	return {
		repository,
		current: current || null,
		latest: latestSha || null,
		updateAvailable: Boolean(current && latestSha && !latestSha.startsWith(current) && !current.startsWith(latestSha)),
		message: latest?.commit?.message?.split("\n")[0] || "Unknown change",
		url: latest?.html_url || `https://github.com/${repository}/commits/main`,
	};
};
