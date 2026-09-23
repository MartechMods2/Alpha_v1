import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeFiles = [
  "core/messages.js",
  "utils/safeAi.js",
  "utils/alphaQuota.js",
  "utils/alphaMention.js",
  "utils/alphaDeliveryRouter.js",
  "utils/desireHub.js",
  "utils/humanEngagement.js",
  "utils/socialGameGenerator.js",
  "commands/group/members/groupGames.js",
  "commands/group/members/desireHub.js",
  "commands/public/chatbot.js",
  "commands/public/aiMedia.js",
  "commands/public/alphaFeaturePack.js",
  "commands/public/alphaPersonalization.js",
  "commands/public/alphaQuota.js",
  "commands/group/members/alphaPolls.js",
  "commands/group/admins/alphaSettings.js",
  "commands/group/admins/safeAiAdmin.js",
  "commands/owner/alphaHealth.js",
];

const exportedNames = (source) => {
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const raw of match[1].split(",")) {
      const item = raw.trim();
      if (!item) continue;
      const key = item.split(":")[0].trim();
      if (key) names.add(key);
    }
  }
  for (const match of source.matchAll(/export\s*\{([\s\S]*?)\}\s*;?/g)) {
    for (const raw of match[1].split(",")) {
      const item = raw.trim();
      if (!item) continue;
      const parts = item.split(/\s+as\s+/);
      names.add((parts[1] || parts[0]).trim());
    }
  }
  if (/export\s+default\b/.test(source)) names.add("default");
  return names;
};

test("Alpha runtime relative named imports resolve to real exports", () => {
  const failures = [];

  for (const relativeFile of runtimeFiles) {
    const file = path.join(root, relativeFile);
    const source = readFileSync(file, "utf8");
    const importPattern = /^\s*import\s*\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']\s*;?/gm;

    for (const match of source.matchAll(importPattern)) {
      const specifier = match[2];
      let target = path.resolve(path.dirname(file), specifier);
      if (!path.extname(target)) target += ".js";
      if (!existsSync(target) || !target.endsWith(".js")) continue;

      const targetSource = readFileSync(target, "utf8");
      const names = exportedNames(targetSource);
      for (const raw of match[1].split(",")) {
        const item = raw.trim().replace(/^type\s+/, "");
        if (!item) continue;
        const imported = item.split(/\s+as\s+/)[0].trim();
        if (!names.has(imported)) {
          failures.push(`${relativeFile} imports ${imported} from ${path.relative(root, target)}`);
        }
      }
    }
  }

  assert.deepEqual(failures, []);
});
