import test from "node:test";
import assert from "node:assert/strict";
import defensiveSecurityLab from "../commands/public/defensiveSecurityLab.js";
import { claimSecurityQuota, runDefensiveCheck, SECURITY_COMMANDS } from "../utils/defensiveSecurityLab.js";

test("defensive pack exposes 110 distinct operations", () => {
	assert.equal(SECURITY_COMMANDS.length, 110);
	assert.equal(new Set(SECURITY_COMMANDS).size, 110);
	assert.equal(new Set(defensiveSecurityLab().cmd).size, defensiveSecurityLab().cmd.length);
});

test("URL checks remain offline and identify common warning signals", () => {
	assert.match(runDefensiveCheck("securlrisk", "http://bit.ly/a"), /HIGH|MEDIUM/);
	assert.equal(runDefensiveCheck("securlhost", "https://example.com/a"), "example.com");
	assert.equal(runDefensiveCheck("secdefang", "https://example.com"), "hxxps://example[.]com");
});

test("defensive IOC, credential and log checks return bounded summaries", () => {
	assert.match(runDefensiveCheck("seccvecheck", "CVE-2026-12345"), /YES/);
	assert.match(runDefensiveCheck("seccredentialscan", "API_KEY=hidden"), /1/);
	assert.match(runDefensiveCheck("seclogsummary", "1.1.1.1 GET / 200"), /IPs: 1/);
});

test("security quota is conservative", () => {
	const jid = `test-${Date.now()}`;
	for (let index = 0; index < 12; index++) assert.equal(claimSecurityQuota(jid, 1_000).allowed, true);
	assert.equal(claimSecurityQuota(jid, 1_000).allowed, false);
});
