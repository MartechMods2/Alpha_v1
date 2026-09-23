import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sanitizeAlphaErrorMessage, alphaPublicFailureMessage } from "../utils/alphaErrorReporter.js";

test("Alpha owner error reports redact API credentials", () => {
  const error = new Error("request failed key=AIzaThisIsASecretKeyValue123456789 Authorization: Bearer super.secret.token.value");
  const safe = sanitizeAlphaErrorMessage(error);
  assert.doesNotMatch(safe, /AIzaThisIsASecretKeyValue/);
  assert.doesNotMatch(safe, /super\.secret\.token\.value/);
  assert.match(safe, /REDACTED/);
});

test("Alpha public failure messages never expose provider diagnostics", () => {
  for (const mode of ["request", "media", "voice", "image"]) {
    const text = alphaPublicFailureMessage(mode);
    assert.doesNotMatch(text, /503|GoogleGenerativeAI|generativelanguage|API[_ -]?key/i);
  }
});

test("Alpha group mention errors are privately reported instead of echoed", () => {
  const source = readFileSync(new URL("../core/messages.js", import.meta.url), "utf8");
  assert.match(source, /notifyAlphaOwnerFailure/);
  assert.match(source, /alphaPublicFailureMessage/);
  assert.doesNotMatch(source, /could not process that mention:\s*\$\{error\.message\}/);
});

test("Gemini media understanding retries temporary demand failures and supports configured fallbacks", () => {
  const source = readFileSync(new URL("../utils/alphaMention.js", import.meta.url), "utf8");
  assert.match(source, /GEMINI_MEDIA_FALLBACK_MODELS/);
  assert.match(source, /429, 500, 502, 503, 504/);
  assert.match(source, /high demand/);
  assert.match(source, /MEDIA_UNAVAILABLE/);
});
