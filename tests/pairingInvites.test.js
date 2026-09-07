import test from "node:test";
import assert from "node:assert/strict";
import { createPairingInvite, consumePairingInvite } from "../utils/pairingInvites.js";

test("pairing invitation works exactly once", () => {
	const invitation = createPairingInvite();
	assert.equal(consumePairingInvite(invitation.token), true);
	assert.equal(consumePairingInvite(invitation.token), false);
});

test("pairing invitation rejects malformed and altered tokens", () => {
	const invitation = createPairingInvite();
	assert.equal(consumePairingInvite("missing"), false);
	assert.equal(consumePairingInvite(`${invitation.token}x`), false);
	assert.equal(consumePairingInvite(""), false);
});
