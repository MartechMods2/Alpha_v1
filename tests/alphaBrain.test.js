import assert from "node:assert/strict";
import test from "node:test";
import { cleanAlphaResponse, compactAlphaMessages, extractAlphaDirective, speakerAwareHistory } from "../utils/alphaBrain.js";

test("Alpha answer directives are parsed without leaking the control prefix", () => {
  const result = extractAlphaDirective("deep: explain black holes");
  assert.equal(result.mode, "deep");
  assert.equal(result.prompt, "explain black holes");
  assert.match(result.instruction, /thorough/i);
});

test("speaker-aware history preserves who said group messages", () => {
  const history = speakerAwareHistory([
    { role: "user", senderName: "Ada", parts: [{ text: "Ship it Friday" }] },
    { role: "model", senderName: "Alpha", parts: [{ text: "Noted" }] },
  ]);
  assert.deepEqual(history, [
    { role: "user", content: "[Ada]: Ship it Friday" },
    { role: "assistant", content: "Noted" },
  ]);
});

test("Alpha compacts old context while retaining the newest messages", () => {
  const messages = [
    { role: "user", content: "a".repeat(80) },
    { role: "assistant", content: "b".repeat(80) },
    { role: "user", content: "latest" },
  ];
  const compacted = compactAlphaMessages(messages, 100);
  assert.equal(compacted.at(-1).content, "latest");
  assert.ok(compacted.length < messages.length);
});

test("Alpha response cleanup removes duplicated assistant labels", () => {
  assert.equal(cleanAlphaResponse("⚡Alpha⚡: Hello there", "Alpha"), "Hello there");
});
