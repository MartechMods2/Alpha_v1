import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

test("Alpha group AI paths no longer use the legacy in-memory safe AI budget", () => {
  const files = [
    "commands/public/chatbot.js",
    "commands/public/aiMedia.js",
    "commands/public/alphaFeaturePack.js",
    "commands/public/alphaPersonalization.js",
    "commands/group/members/alphaPolls.js",
    "commands/group/admins/safeAiAdmin.js",
    "utils/alphaDeliveryRouter.js",
  ];
  for (const file of files) assert.doesNotMatch(read(file), /\buseSafeAiBudget\b/, file);
});

test("Alpha admin quota setter no longer collides with public alphaquota", () => {
  const admin = read("commands/group/admins/alphaSettings.js");
  const publicQuota = read("commands/public/alphaQuota.js");
  assert.doesNotMatch(admin, /"alphaquota"/);
  assert.match(admin, /"alphalimit"/);
  assert.match(publicQuota, /"alphaquota"/);
});

test("Alpha default provider order prioritizes providers proven healthy in production", () => {
  const source = read("utils/safeAi.js");
  const groq = source.indexOf('"groq"');
  const kilo = source.indexOf('"kilo"', groq + 1);
  const cloudflare = source.indexOf('"cloudflare"', kilo + 1);
  assert.ok(groq >= 0 && kilo > groq && cloudflare > kilo);
  assert.match(source, /ALPHA_AI_DISABLED_PROVIDERS/);
  assert.match(source, /providerTimeoutMs/);
});
