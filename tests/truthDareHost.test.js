import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseTruthDareStart } from "../utils/truthDareStartOptions.js";
import {
  buildTruthDareDeck,
  normalizeTruthDareTheme,
  truthDarePromptCount,
  truthDareThemes,
} from "../utils/truthDarePrompts.js";

test("Truth or Dare ships with a large safe themed local prompt library", () => {
  assert.ok(truthDarePromptCount() >= 100);
  assert.deepEqual(truthDareThemes, ["classic", "funny", "deep", "friendship", "tech", "random"]);
  assert.equal(normalizeTruthDareTheme("FUNNY"), "funny");
  assert.equal(normalizeTruthDareTheme("unknown"), "classic");
  assert.ok(buildTruthDareDeck({ theme: "classic", type: "truth" }).length >= 10);
  assert.ok(buildTruthDareDeck({ theme: "tech", type: "dare" }).length >= 20);
});

test("td command aliases and complete lifecycle controls are registered", async () => {
  const source = await readFile(new URL("../commands/group/members/truthDare.js", import.meta.url), "utf8");
  for (const alias of ["td", "tod", "truthdare", "truthordare", "tord", "todgame"]) {
    assert.match(source, new RegExp(`"${alias}"`));
  }
  for (const action of ["start", "join", "leave", "close", "stop", "next", "resume", "rules", "status", "score", "leaderboard", "stats", "answer"]) {
    assert.match(source, new RegExp(`"${action}"`));
  }
});

test("start parses a bounded per-game lobby duration", () => {
  assert.deepEqual(parseTruthDareStart([]), { rounds: 2, theme: "classic", lobbyMs: 30_000 });
  assert.deepEqual(parseTruthDareStart(["3", "funny", "lobby=2m"]), { rounds: 3, theme: "funny", lobbyMs: 120_000 });
  assert.equal(parseTruthDareStart(["lobby=90s"]).lobbyMs, 90_000);
  assert.throws(() => parseTruthDareStart(["lobby=20s"]), /between 30 seconds and 10 minutes/);
  assert.throws(() => parseTruthDareStart(["lobby=11m"]), /between 30 seconds and 10 minutes/);
  assert.throws(() => parseTruthDareStart(["lobby=abc"]), /Use lobby=/);
});

test("host engine auto-enrols starter and owns lobby, turns, timers, scoring and persistence", async () => {
  const source = await readFile(new URL("../utils/truthDareHost.js", import.meta.url), "utf8");
  assert.match(source, /participants: \[starter\]/);
  assert.match(source, /registerInteractivePoll/);
  assert.match(source, /LOBBY_MS = 30_000/);
  assert.match(source, /CHOICE_MS = 45_000/);
  assert.match(source, /RESPONSE_MS = 90_000/);
  assert.match(source, /TRUTH_POINTS = 10/);
  assert.match(source, /DARE_POINTS = 15/);
  assert.match(source, /PERFECT_BONUS = 5/);
  assert.match(source, /MAX_ROUNDS = 5/);
  assert.match(source, /streakBonus/);
  assert.match(source, /recordTruthDareSessionPlayer/);
  assert.match(source, /saveTruthDareSessionSnapshot/);
  assert.match(source, /restoreTruthDareSession/);
  assert.match(source, /deleteTruthDareSessionSnapshot/);
  assert.match(source, /recordGameResult/);
  assert.match(source, /finishSession/);
  assert.match(source, /Truth or Dare Complete/);
  assert.match(source, /poll lobby unavailable, using command fallback/);
});

test("passive community routing lets only the active turn engine consume natural replies", async () => {
  const source = await readFile(new URL("../utils/passiveCommunity.js", import.meta.url), "utf8");
  assert.match(source, /handleTruthDareAction/);
  assert.match(source, /fromCommand: false/);
  assert.match(source, /mediaResponse: Boolean\(mediaResponse\)/);
});

test("hosted game never penalizes a skip with negative points", async () => {
  const source = await readFile(new URL("../utils/truthDareHost.js", import.meta.url), "utf8");
  assert.match(source, /gets \*0 points\* this turn/);
  assert.doesNotMatch(source, /score\s*-=/);
});


test("queued sends return the WhatsApp message result so hosted games can track prompt ids", async () => {
  const source = await readFile(new URL("../queue/messageQueue.js", import.meta.url), "utf8");
  assert.match(source, /const sendResult = await message\.sendFunction\(\)/);
  assert.match(source, /message\.resolve\?\.\(sendResult\)/);
});

test("active Truth or Dare snapshots are stored separately from permanent player stats", async () => {
  const source = await readFile(new URL("../db/truthDareData.js", import.meta.url), "utf8");
  assert.match(source, /TruthDareSessions/);
  assert.match(source, /saveTruthDareSessionSnapshot/);
  assert.match(source, /getTruthDareSessionSnapshot/);
  assert.match(source, /deleteTruthDareSessionSnapshot/);
});
