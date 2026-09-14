export const resolveGoogleTtsMethod = (moduleNamespace, methodName) => {
	const roots = [
		moduleNamespace,
		moduleNamespace?.default,
		moduleNamespace?.default?.default,
	].filter(Boolean);

	for (const root of roots) {
		const method = root?.[methodName];
		if (typeof method === "function") return method.bind(root);
	}

	return null;
};

export const resolveLegacyGoogleTtsFunction = (moduleNamespace) => {
	for (const candidate of [
		moduleNamespace,
		moduleNamespace?.default,
		moduleNamespace?.default?.default,
	]) {
		if (typeof candidate === "function") return candidate;
	}
	return null;
};

export const getGoogleTtsCapabilities = (moduleNamespace) => {
	const methods = [
		"getAllAudioBase64",
		"getAudioBase64",
		"getAllAudioUrls",
		"getAudioUrl",
	];

	return {
		...Object.fromEntries(
			methods.map((name) => [name, Boolean(resolveGoogleTtsMethod(moduleNamespace, name))]),
		),
		legacyFunction: Boolean(resolveLegacyGoogleTtsFunction(moduleNamespace)),
	};
};

export const splitGoogleTtsText = (rawText, maxLength = 180) => {
	const text = String(rawText || "").replace(/\s+/g, " ").trim();
	const limit = Math.max(40, Math.min(200, Number(maxLength) || 180));
	if (!text) return [];
	if (text.length <= limit) return [text];

	const chunks = [];
	let remaining = text;

	while (remaining.length > limit) {
		const window = remaining.slice(0, limit + 1);
		let cut = Math.max(
			window.lastIndexOf(". "),
			window.lastIndexOf("! "),
			window.lastIndexOf("? "),
			window.lastIndexOf("; "),
			window.lastIndexOf(", "),
		);

		if (cut >= Math.floor(limit * 0.45)) {
			cut += 1;
		} else {
			cut = window.lastIndexOf(" ");
			if (cut < Math.floor(limit * 0.45)) cut = limit;
		}

		const chunk = remaining.slice(0, cut).trim();
		if (chunk) chunks.push(chunk);
		remaining = remaining.slice(cut).trim();
	}

	if (remaining) chunks.push(remaining);
	return chunks;
};
