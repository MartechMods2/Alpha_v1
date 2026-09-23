import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../utils/alphaDeliveryRouter.js", import.meta.url), "utf8");

test("Alpha delivery router uses the persistent quota service", () => {
  assert.match(source, /consumeAlphaUsage/);
  assert.doesNotMatch(source, /\buseAlphaQuota\b/);
  assert.doesNotMatch(source, /\buseSafeAiBudget\b/);
});

test("Alpha delivery router keeps creator or configured Moderator unlimited", () => {
  assert.match(source, /isConfiguredModerator/);
  assert.match(source, /unlimitedAi/);
});
