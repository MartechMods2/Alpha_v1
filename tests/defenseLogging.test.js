import test from "node:test";
import assert from "node:assert/strict";
import { safeLogParts } from "../utils/safeLog.js";
test("security logging suppresses objects, error payloads, credentials, URLs and private identifiers", () => {
  const secret = "secret-demo-value";
  const result = safeLogParts(
    [
      { body: "private text" },
      new Error("private text"),
      `token ${secret} https://service.test?token=${secret} 123456789@lid person@example.com 2348012345678`,
    ],
    { API_KEY: secret },
  ).join(" ");
  for (const value of [
    "private text",
    secret,
    "123456789",
    "person@example.com",
    "2348012345678",
    "service.test",
  ])
    assert.equal(result.includes(value), false);
  const cycle = {};
  cycle.loop = cycle;
  assert.doesNotThrow(() => safeLogParts([cycle]));
});
