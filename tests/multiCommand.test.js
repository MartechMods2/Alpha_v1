import test from "node:test";
import assert from "node:assert/strict";
import { contextForCommandSegment, parseCommandChain } from "../utils/multiCommand.js";

test("multi-command parser executes only separators followed by a command prefix", () => {
	const parsed = parseCommandChain("$mute @2348011111111 2h, $ban @2348022222222, $meme Hello, world", "$", 6);
	assert.equal(parsed.truncated, false);
	assert.deepEqual(parsed.commands.map((item) => item.command), ["mute", "ban", "meme"]);
	assert.deepEqual(parsed.commands[0].args, ["@2348011111111", "2h"]);
	assert.deepEqual(parsed.commands[2].args, ["Hello,", "world"]);
});

test("multi-command parser supports semicolons and new lines", () => {
	const parsed = parseCommandChain("$ping; $help\n$alive", "$", 6);
	assert.deepEqual(parsed.commands.map((item) => item.command), ["ping", "help", "alive"]);
});

test("multi-command parser caps command bursts", () => {
	const input = "$a, $b, $c, $d, $e, $f, $g, $h";
	const parsed = parseCommandChain(input, "$", 6);
	assert.equal(parsed.commands.length, 6);
	assert.equal(parsed.truncated, true);
});

test("command segment context moves that segment's mention to the front", () => {
	const context = {
		mentionedJid: ["2348011111111@s.whatsapp.net", "2348022222222@s.whatsapp.net"],
	};
	const parsed = parseCommandChain("$mute @2348011111111 2h, $ban @2348022222222", "$", 6);
	const second = contextForCommandSegment(parsed.commands[1], context);
	assert.deepEqual(second.mentionedJid, ["2348022222222@s.whatsapp.net"]);
	assert.deepEqual(context.mentionedJid, ["2348011111111@s.whatsapp.net", "2348022222222@s.whatsapp.net"]);
});

test("normal commas do not create extra commands", () => {
	const parsed = parseCommandChain("$meme Lagos, Nigeria is active", "$", 6);
	assert.equal(parsed.commands.length, 1);
	assert.equal(parsed.commands[0].command, "meme");
});
