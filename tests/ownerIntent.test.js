import test from "node:test";
import assert from "node:assert/strict";
import { detectOwnerIntent, isMartechOwner } from "../utils/ownerIntent.js";

test("owner intent recognizes the explicit tag-all request", () => {
	assert.deepEqual(detectOwnerIntent("I want you to mention all the members"), {
		command: "tagall", args: [], normalized: "i want you to mention all the members",
	});
});

test("owner intent rejects ambiguous and destructive requests", () => {
	assert.equal(detectOwnerIntent("do it"), null);
	assert.equal(detectOwnerIntent("remove everyone from the group"), null);
	assert.equal(detectOwnerIntent("hack this phone"), null);
});

test("Martech identity uses normalized digits", () => {
	const previous = process.env.MARTECH_OWNER_NUMBER;
	process.env.MARTECH_OWNER_NUMBER = "+234 814 089 3169";
	assert.equal(isMartechOwner("2348140893169"), true);
	assert.equal(isMartechOwner("2348085109399"), false);
	if (previous === undefined) delete process.env.MARTECH_OWNER_NUMBER;
	else process.env.MARTECH_OWNER_NUMBER = previous;
});
