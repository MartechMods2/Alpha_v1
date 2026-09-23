import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

test("Alpha no longer has legacy in-memory safe AI budget references", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".js")) files.push(full);
    }
  };
  for (const dir of ["commands", "core", "utils"]) walk(path.join(root, dir));
  const failures = files
    .filter((file) => /\buseSafeAiBudget\b/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file));
  assert.deepEqual(failures, []);
});

test("Alpha unlimited quota bypass defaults to owner-only", () => {
  const quota = read("utils/alphaQuota.js");
  assert.doesNotMatch(quota, /isConfiguredModerator/);
  assert.match(quota, /return Boolean\(isOwner\)/);
  assert.match(quota, /ALPHA_UNLIMITED_NUMBERS/);
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
