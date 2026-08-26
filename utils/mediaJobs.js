import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DEFAULT_MEDIA_CONFIG = Object.freeze({
	safeMode: false,
	maxConcurrentJobs: 1,
	perUserDailyLimit: 20,
	perGroupDailyLimit: 100,
	maxImageMb: 12,
	maxVideoMb: 25,
	maxVideoSeconds: 10,
	disabledFeatures: [],
	providerFallbacks: true,
	alphaGlobalEnabled: true,
	alphaName: "Alpha",
	alphaSystemPrompt: "",
});

let config = { ...DEFAULT_MEDIA_CONFIG };
const queue = [];
const recentJobs = [];
const retryTasks = new Map();
const usage = new Map();
const providerState = new Map();
let activeJobs = 0;

const clamp = (value, min, max, fallback) => {
	const number = Number(value);
	return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const dateKey = () => new Date().toISOString().slice(0, 10);
const usageKey = (scope, id) => `${dateKey()}:${scope}:${id}`;

const trimMaps = () => {
	if (usage.size > 5000) {
		const today = `${dateKey()}:`;
		for (const key of usage.keys()) if (!key.startsWith(today)) usage.delete(key);
	}
	while (recentJobs.length > 100) recentJobs.shift();
	if (retryTasks.size > 10) retryTasks.delete(retryTasks.keys().next().value);
};

export const sanitizeMediaConfig = (value = {}) => ({
	safeMode: Boolean(value.safeMode),
	maxConcurrentJobs: clamp(value.maxConcurrentJobs, 1, 2, DEFAULT_MEDIA_CONFIG.maxConcurrentJobs),
	perUserDailyLimit: clamp(value.perUserDailyLimit, 1, 100, DEFAULT_MEDIA_CONFIG.perUserDailyLimit),
	perGroupDailyLimit: clamp(value.perGroupDailyLimit, 5, 500, DEFAULT_MEDIA_CONFIG.perGroupDailyLimit),
	maxImageMb: clamp(value.maxImageMb, 2, 20, DEFAULT_MEDIA_CONFIG.maxImageMb),
	maxVideoMb: clamp(value.maxVideoMb, 5, 50, DEFAULT_MEDIA_CONFIG.maxVideoMb),
	maxVideoSeconds: clamp(value.maxVideoSeconds, 3, 20, DEFAULT_MEDIA_CONFIG.maxVideoSeconds),
	disabledFeatures: Array.isArray(value.disabledFeatures)
		? [...new Set(value.disabledFeatures.map((item) => String(item).toLowerCase().replace(/[^a-z0-9_-]/g, "")).filter(Boolean))].slice(0, 80)
		: [],
	providerFallbacks: value.providerFallbacks !== false,
	alphaGlobalEnabled: value.alphaGlobalEnabled !== false,
	alphaName: String(value.alphaName || DEFAULT_MEDIA_CONFIG.alphaName).replace(/[\r\n<>]/g, " ").trim().slice(0, 30) || "Alpha",
	alphaSystemPrompt: String(value.alphaSystemPrompt || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, 2000),
});

export const setMediaRuntimeConfig = (value = {}) => {
	config = sanitizeMediaConfig({ ...config, ...value });
	return { ...config };
};

export const getMediaRuntimeConfig = () => ({ ...config, disabledFeatures: [...config.disabledFeatures] });

export const isMediaFeatureEnabled = (feature) =>
	!config.safeMode && !config.disabledFeatures.includes(String(feature || "").toLowerCase());

const assertQuota = ({ feature, groupJid, senderJid }) => {
	if (!isMediaFeatureEnabled(feature)) throw new Error("This media feature is disabled by the administrator");
	const userKey = usageKey("user", senderJid || "unknown");
	const groupKey = usageKey("group", groupJid || "direct");
	if ((usage.get(userKey) || 0) >= config.perUserDailyLimit) throw new Error("Your daily media limit has been reached");
	if ((usage.get(groupKey) || 0) >= config.perGroupDailyLimit) throw new Error("This group's daily media limit has been reached");
	usage.set(userKey, (usage.get(userKey) || 0) + 1);
	usage.set(groupKey, (usage.get(groupKey) || 0) + 1);
};

const runNext = async () => {
	while (activeJobs < config.maxConcurrentJobs && queue.length) {
		const item = queue.shift();
		activeJobs += 1;
		item.job.status = "running";
		item.job.startedAt = new Date().toISOString();
		Promise.resolve()
			.then(item.task)
			.then((result) => {
				item.job.status = "completed";
				retryTasks.delete(item.job.id);
				item.resolve(result);
			})
			.catch((error) => {
				item.job.status = "failed";
				item.job.error = String(error?.message || error).slice(0, 300);
				if (item.retry) retryTasks.set(item.job.id, item.retry);
				item.reject(error);
			})
			.finally(() => {
				item.job.finishedAt = new Date().toISOString();
				item.job.durationMs = Date.parse(item.job.finishedAt) - Date.parse(item.job.startedAt);
				activeJobs -= 1;
				trimMaps();
				runNext();
			});
	}
};

export const runMediaJob = ({ feature, groupJid, senderJid, task, retryable = true }) => {
	if (typeof task !== "function") throw new TypeError("Media job task must be a function");
	assertQuota({ feature, groupJid, senderJid });
	const job = {
		id: randomUUID(),
		feature: String(feature || "media").slice(0, 50),
		groupJid: String(groupJid || "direct").slice(0, 120),
		senderJid: String(senderJid || "unknown").slice(0, 120),
		status: "queued",
		createdAt: new Date().toISOString(),
	};
	recentJobs.push(job);
	const retry = retryable ? { feature, groupJid, senderJid, task } : null;
	const completion = new Promise((resolve, reject) => queue.push({ job, task, retry, resolve, reject }));
	runNext();
	return completion;
};

export const retryMediaJob = (jobId) => {
	const previous = retryTasks.get(jobId);
	if (!previous) throw new Error("This job can no longer be retried");
	return runMediaJob(previous);
};

export const reportProviderResult = (name, ok, error = "") => {
	const key = String(name || "unknown").toLowerCase();
	const previous = providerState.get(key) || { failures: 0 };
	const next = ok
		? { failures: 0, available: true, lastSuccessAt: new Date().toISOString(), disabledUntil: null }
		: {
			...previous,
			available: false,
			failures: previous.failures + 1,
			lastError: String(error || "Provider failed").slice(0, 240),
			lastFailureAt: new Date().toISOString(),
			disabledUntil: previous.failures + 1 >= 3 ? new Date(Date.now() + 10 * 60_000).toISOString() : null,
		};
	providerState.set(key, next);
	return next;
};

export const isProviderAvailable = (name) => {
	const state = providerState.get(String(name || "").toLowerCase());
	return !state?.disabledUntil || Date.parse(state.disabledUntil) <= Date.now();
};

const tempStorageBytes = () => {
	const dir = path.resolve("temp");
	if (!fs.existsSync(dir)) return 0;
	return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
		if (!entry.isFile()) return total;
		try { return total + fs.statSync(path.join(dir, entry.name)).size; } catch { return total; }
	}, 0);
};

export const checkFfmpegHealth = async (ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg") => {
	try {
		const { stdout, stderr } = await execFileAsync(ffmpegPath, ["-version"], { timeout: 5000 });
		const firstLine = `${stdout || stderr}`.split("\n")[0].slice(0, 180);
		return { ok: true, path: ffmpegPath, version: firstLine };
	} catch (error) {
		return { ok: false, path: ffmpegPath, error: error.message };
	}
};

export const getProviderHealth = () => ({
	removeBg: { configured: Boolean(process.env.REMOVE_BG_KEY), ...(providerState.get("removebg") || {}) },
	nvidia: { configured: Boolean(process.env.NVIDIA_API_KEY), ...(providerState.get("nvidia") || {}) },
	gemini: { configured: Boolean(process.env.GOOGLE_API_KEY), ...(providerState.get("gemini") || {}) },
	memeApi: { configured: true, ...(providerState.get("memeapi") || {}) },
});

export const getMediaRuntimeStatus = () => ({
	config: getMediaRuntimeConfig(),
	queue: { queued: queue.length, active: activeJobs },
	jobs: [...recentJobs].reverse().slice(0, 50),
	providers: getProviderHealth(),
	storageBytes: tempStorageBytes(),
	usage: {
		today: dateKey(),
		requests: [...usage.entries()].filter(([key]) => key.startsWith(`${dateKey()}:user:`)).reduce((sum, [, count]) => sum + count, 0),
	},
});
