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

test('quoted, escaped and ordinary argument commas remain intact', () => {
 const parsed = parseCommandChain('$meme "Hello, $world"\\, $literal, $ping');
 assert.deepEqual(parsed.commands.map(s=>s.command), ['meme','ping']);
 assert.match(parsed.commands[0].inputText, /Hello, \$world/);
 assert.equal(parseCommandChain("$meme don't stop, $ping").commands.length,2);
 assert.equal(parseCommandChain('$meme `a, $b`, $ping').commands.length,2);
});

test('custom prefixes and unprefixed comma arguments work',()=>{
 assert.deepEqual(parseCommandChain('!ping, !help','!').commands.map(s=>s.command),['ping','help']);
 assert.equal(parseCommandChain('$meme hi, help me').commands.length,1);
});

test('segments preserve quote/media metadata and isolate mentions',async()=>{
 const {messageForCommandSegment}=await import('../utils/multiCommand.js');
 const original={key:{id:'same'},message:{extendedTextMessage:{text:'$a @2348011111111, $b',contextInfo:{stanzaId:'quoted',participant:'author@lid',mentionedJid:['2348011111111@s.whatsapp.net']}}}};
 const segment=parseCommandChain(original.message.extendedTextMessage.text).commands[1];
 const out=messageForCommandSegment(original,segment,'extendedTextMessage');
 assert.equal(out.message.extendedTextMessage.text,'$b');
 assert.deepEqual(out.message.extendedTextMessage.contextInfo.mentionedJid,[]);
 assert.equal(out.message.extendedTextMessage.contextInfo.stanzaId,'quoted');
 assert.equal(original.message.extendedTextMessage.contextInfo.mentionedJid.length,1);
});

test('dispatch runs serially, preserves permission denials and continues after failures',async()=>{
 const {runCommandSegments}=await import('../utils/multiCommand.js');
 const calls=[];let active=0;
 await runCommandSegments(parseCommandChain('$ping, $restricted, $fail, $help').commands,async(s)=>{
  assert.equal(active,0);active++;await Promise.resolve();calls.push(s.command);active--;
  if(s.command==='restricted'){calls.push('denied');return;}
  if(s.command==='fail')throw Error('private error');
 },async(s)=>calls.push('failed:'+s.command));
 assert.deepEqual(calls,['ping','restricted','denied','fail','failed:fail','help']);
});
