import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreatorBirthdayGreeting,
  creatorBirthdayDateKey,
  getCreatorBirthdayKnowledge,
  isCreatorBirthdayToday,
} from "../utils/creatorBirthday.js";

test("Creator birthday activates only on September 25 in bot-local time", () => {
  assert.equal(isCreatorBirthdayToday(new Date("2026-09-25T12:00:00Z")), true);
  assert.equal(isCreatorBirthdayToday(new Date("2026-09-24T12:00:00Z")), false);
  assert.equal(isCreatorBirthdayToday(new Date("2026-09-26T12:00:00Z")), false);
});

test("Creator birthday knowledge forbids advance reminders", () => {
  const before = getCreatorBirthdayKnowledge(new Date("2026-09-24T12:00:00Z"));
  assert.match(before, /September 25/);
  assert.match(before, /Never send advance birthday reminders/i);
  assert.match(before, /Do not proactively mention/i);
});

test("Birthday greeting is Aura Farming Tech themed", () => {
  const greeting = buildCreatorBirthdayGreeting(new Date("2026-09-25T12:00:00Z"));
  assert.match(greeting, /Happy Birthday/i);
  assert.match(greeting, /AURA FARMING · TECH EDITION/);
  assert.match(greeting, /Creator Mode/i);
  assert.match(greeting, /Birthday Patch Notes/i);
});

test("Birthday date key stays ISO-like", () => {
  assert.equal(creatorBirthdayDateKey(new Date("2026-09-25T12:00:00Z")), "2026-09-25");
});
