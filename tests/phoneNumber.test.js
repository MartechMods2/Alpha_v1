import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLookupNumber } from "../utils/phoneNumber.js";

test("normalizes common Nigerian mobile formats", () => {
	for (const input of ["0803 123 4567", "+234 803 123 4567", "2348031234567", "0803-123-4567"]) {
		assert.deepEqual(normalizeLookupNumber(input), {
			e164: "+2348031234567",
			number: "2348031234567",
			countryCode: "NG",
			national: "8031234567",
		});
	}
	assert.equal(normalizeLookupNumber("0913 123 4567")?.countryCode, "NG");
});

test("detects explicit international country calling codes", () => {
	assert.equal(normalizeLookupNumber("+919876543210")?.countryCode, "IN");
	assert.equal(normalizeLookupNumber("00442071838750")?.countryCode, "GB");
	assert.equal(normalizeLookupNumber("+14155552671")?.countryCode, "US");
	assert.equal(normalizeLookupNumber("+233241234567")?.countryCode, "GH");
});

test("supports an ISO country hint for non-Nigerian local numbers", () => {
	assert.equal(normalizeLookupNumber("GB 020 7183 8750")?.e164, "+442071838750");
	assert.equal(normalizeLookupNumber("IN: 98765 43210")?.e164, "+919876543210");
	assert.equal(normalizeLookupNumber("4155552671", "US")?.e164, "+14155552671");
});

test("rejects malformed phone input", () => {
	assert.equal(normalizeLookupNumber("hello"), null);
	assert.equal(normalizeLookupNumber("123"), null);
	assert.equal(normalizeLookupNumber("+999123456789"), null);
});
