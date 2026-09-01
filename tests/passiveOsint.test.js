import assert from "node:assert/strict";
import test from "node:test";
import { claimOsintQuota, identifyHash, isPublicIp, normalizeDomain } from "../utils/passiveOsint.js";
import { FEATURE_REQUIREMENTS } from "../utils/setupAudit.js";

test("OSINT domain normalization accepts public DNS names and rejects unsafe input", () => {
	assert.equal(normalizeDomain("https://Example.COM/path"), "example.com");
	assert.equal(normalizeDomain("*.sub.example.com."), "sub.example.com");
	assert.equal(normalizeDomain("localhost"), null);
	assert.equal(normalizeDomain("127.0.0.1"), null);
	assert.equal(normalizeDomain("bad_name.example"), null);
});

test("public-IP gate blocks private, loopback, documentation and link-local ranges", () => {
	assert.equal(isPublicIp("1.1.1.1"), true);
	assert.equal(isPublicIp("2606:4700:4700::1111"), true);
	for (const value of ["127.0.0.1", "10.2.3.4", "172.20.1.1", "192.168.1.1", "169.254.1.2", "192.0.2.1", "::1", "fe80::1", "2001:db8::1"]) {
		assert.equal(isPublicIp(value), false, `${value} must be blocked`);
	}
});

test("hash identification reports formats without attempting recovery", () => {
	assert.deepEqual(identifyHash("5d41402abc4b2a76b9719d911017c592"), ["MD5", "MD4", "NTLM (length-compatible only)"]);
	assert.deepEqual(identifyHash("$2b$12$abcdefghijklmnopqrstuu1234567890123456789012345678901"), ["bcrypt"]);
	assert.deepEqual(identifyHash("not-a-hash"), []);
});

test("passive lookups are limited to eight per member in ten minutes", () => {
	const member = `quota-${Date.now()}@s.whatsapp.net`;
	for (let index = 0; index < 8; index += 1) assert.equal(claimOsintQuota(member, 1_000 + index).allowed, true);
	assert.equal(claimOsintQuota(member, 2_000).allowed, false);
	assert.equal(claimOsintQuota(member, 601_001).allowed, true);
});

test("setup audit covers core, AI, search, media, cookies and reliability integrations", () => {
	const names = FEATURE_REQUIREMENTS.map((entry) => entry.name);
	for (const expected of ["Core bot and database", "Alpha AI text", "Google web and image search", "Background removal", "Encrypted backups", "S3-compatible off-site storage"]) {
		assert.ok(names.includes(expected));
	}
});

