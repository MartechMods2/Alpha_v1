import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../utils/alphaDeliveryRouter.js", import.meta.url), "utf8");

test("Alpha delivery router uses the shared persistent quota policy", () => {
  assert.match(source, /claimAlphaGroupAiUsage/);
  assert.match(source, /refundAlphaGroupAiUsage/);
  assert.doesNotMatch(source, /\buseAlphaQuota\b/);
  assert.doesNotMatch(source, /\buseSafeAiBudget\b/);
  assert.doesNotMatch(source, /\bconsumeAlphaUsage\b/);
});

test("Alpha delivery router passes owner identity through the central quota policy", () => {
  assert.match(source, /quotaInput/);
  assert.match(source, /isOwner/);
  assert.match(source, /groupMetadata/);
});
