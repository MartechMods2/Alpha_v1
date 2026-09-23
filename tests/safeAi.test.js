import assert from "node:assert/strict";
import test from "node:test";
import { getAiProviderNames, getAiRuntimeStatus } from "../utils/safeAi.js";

test("Alpha exposes all failover provider slots", () => {
  assert.deepEqual(getAiProviderNames(), [
    "groq",
    "gemini",
    "mistral",
    "kilo",
    "cloudflare",
    "openrouter",
    "aion",
    "nvidia",
  ]);
});

test("Alpha status separates configured readiness from confirmed health", () => {
  const previous = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-key";
  try {
    const status = getAiRuntimeStatus();
    assert.equal(status.ready, true);
    assert.equal(status.providers.groq.configured, true);
    assert.equal(status.activeProvider, null);
    assert.equal(status.nextProvider, "groq");
  } finally {
    if (previous === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previous;
  }
});
