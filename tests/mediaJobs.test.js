import assert from "node:assert/strict";
import test from "node:test";
import {
	getMediaRuntimeStatus,
	reportProviderResult,
	runMediaJob,
	sanitizeMediaConfig,
	setMediaRuntimeConfig,
} from "../utils/mediaJobs.js";

test("media configuration is bounded and strips unsafe feature names", () => {
	const config = sanitizeMediaConfig({
		maxConcurrentJobs: 99,
		perUserDailyLimit: -1,
		maxVideoSeconds: 200,
		disabledFeatures: ["UPScale", "bad feature!"],
		alphaName: "<Alpha>\n",
	});
	assert.equal(config.maxConcurrentJobs, 2);
	assert.equal(config.perUserDailyLimit, 1);
	assert.equal(config.maxVideoSeconds, 20);
	assert.deepEqual(config.disabledFeatures, ["upscale", "badfeature"]);
	assert.equal(config.alphaName, "Alpha");
});

test("media job queue resolves work and records completion", async () => {
	setMediaRuntimeConfig({ safeMode: false, maxConcurrentJobs: 1, perUserDailyLimit: 100, perGroupDailyLimit: 100 });
	const value = await runMediaJob({ feature: "testjob", groupJid: "test@g.us", senderJid: "one@s.whatsapp.net", task: async () => 42, retryable: false });
	assert.equal(value, 42);
	const status = getMediaRuntimeStatus();
	assert.ok(status.jobs.some((job) => job.feature === "testjob" && job.status === "completed"));
});

test("provider circuit opens after three failures and resets after success", () => {
	reportProviderResult("unit-provider", false, "one");
	reportProviderResult("unit-provider", false, "two");
	const failed = reportProviderResult("unit-provider", false, "three");
	assert.ok(failed.disabledUntil);
	const recovered = reportProviderResult("unit-provider", true);
	assert.equal(recovered.failures, 0);
	assert.equal(recovered.available, true);
});
