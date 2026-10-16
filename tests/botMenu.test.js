import test from "node:test";
import assert from "node:assert/strict";
import {
  visibleCommandSections,
  menuOverview,
  commandPage,
} from "../utils/botMenu.js";
import { premiumReply } from "../utils/premiumReplies.js";
const catalogue = {
  publicCommands: [
    {
      cmd: ["help", "menu"],
      desc: "Command help",
      usage: "help <command>",
      source: "/private/source.js",
      secret: "must-not-leak",
    },
  ],
  groupCommands: [{ cmd: ["2048"], desc: "Game", usage: "2048 start" }],
  adminCommands: [
    { cmd: ["ban"], desc: "Word restrictions", usage: "ban word" },
  ],
  ownerCommands: [
    { cmd: ["private-op"], desc: "Owner only", usage: "private-op" },
  ],
};
test("menu whitelists public fields and hides privileged commands from ordinary users", () => {
  const sections = visibleCommandSections(catalogue, { isGroup: true });
  assert.deepEqual(Object.keys(sections), ["public", "group"]);
  const value = JSON.stringify(sections);
  assert.ok(!value.includes("must-not-leak"));
  assert.ok(!value.includes("/private/source"));
  assert.ok(!value.includes("private-op"));
  const overview = menuOverview(sections, "!");
  assert.ok(overview.includes("!menu all"));
  assert.ok(overview.includes("Martech"));
  assert.ok(!overview.includes("menu owner"));
  assert.ok(!overview.includes("menu admin"));
  assert.equal((premiumReply(overview).match(/alpha/gi) || []).length, 1);
});
test("admin menus expose admin commands but reserve owner commands for the owner", () => {
  assert.deepEqual(
    Object.keys(
      visibleCommandSections(catalogue, { isGroup: true, isGroupAdmin: true }),
    ),
    ["public", "group", "admin"],
  );
  assert.deepEqual(
    Object.keys(visibleCommandSections(catalogue, { isOwner: true })),
    ["public", "group", "admin", "owner"],
  );
});
test("command catalogue has bounded pages, usage and next-page instructions", () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    cmd: ["tool" + i],
    desc: "A helpful command description",
    usage: "tool" + i + " <input>",
  }));
  const one = commandPage(rows),
    two = commandPage(rows, { page: 2 });
  assert.ok(one.length < 4000);
  assert.ok(one.includes("Usage: $tool0 <input>"));
  assert.ok(one.includes("Next: $menu all 2"));
  assert.notEqual(one, two);
  for (const page of [0, -1, NaN, Infinity, 999, "2x"])
    assert.ok(commandPage(rows, { page }).startsWith("Choose page"));
});
