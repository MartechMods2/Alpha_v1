import test from "node:test";
import assert from "node:assert/strict";
import { createAdminWebsocketTicket, consumeAdminWebsocketTicket } from "../utils/adminWebsocket.js";
import { authenticateIntegrationRequest, integrationRecipientAllowed } from "../utils/integrationApi.js";
import { editDistance, searchCommands } from "../utils/commandSearch.js";

test("admin WebSocket tickets are valid once only", () => {
	const { token } = createAdminWebsocketTicket();
	assert.equal(consumeAdminWebsocketTicket(token), true);
	assert.equal(consumeAdminWebsocketTicket(token), false);
	assert.equal(consumeAdminWebsocketTicket("invalid"), false);
});

test("integration API is disabled by default and validates bearer credentials", () => {
	const before = process.env.INTEGRATION_API_KEY;
	delete process.env.INTEGRATION_API_KEY;
	assert.equal(authenticateIntegrationRequest("").status, 503);
	process.env.INTEGRATION_API_KEY = "a-safe-test-secret-that-is-long-enough";
	assert.equal(authenticateIntegrationRequest("Bearer wrong").status, 401);
	assert.equal(authenticateIntegrationRequest(`Bearer ${process.env.INTEGRATION_API_KEY}`).ok, true);
	if (before === undefined) delete process.env.INTEGRATION_API_KEY; else process.env.INTEGRATION_API_KEY = before;
});

test("integration recipients use an explicit normalized allowlist", () => {
	const before = process.env.INTEGRATION_ALLOWED_RECIPIENTS;
	process.env.INTEGRATION_ALLOWED_RECIPIENTS = "+234 801 234 5678,12025550123";
	assert.equal(integrationRecipientAllowed("2348012345678@s.whatsapp.net"), true);
	assert.equal(integrationRecipientAllowed("2348099999999@s.whatsapp.net"), false);
	if (before === undefined) delete process.env.INTEGRATION_ALLOWED_RECIPIENTS; else process.env.INTEGRATION_ALLOWED_RECIPIENTS = before;
});

test("command search tolerates typos and searches descriptions", () => {
	const commands = [
		{ cmd: ["sticker", "s"], desc: "Create a WhatsApp sticker", usage: "sticker" },
		{ cmd: ["birthday"], desc: "Save a birthday reminder", usage: "birthday set" },
	];
	assert.equal(editDistance("stikcer", "sticker"), 2);
	assert.equal(searchCommands(commands, "stikcer")[0].cmd[0], "sticker");
	assert.equal(searchCommands(commands, "reminder")[0].cmd[0], "birthday");
});
