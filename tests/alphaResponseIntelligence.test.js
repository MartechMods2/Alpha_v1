import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { alphaResponseTokenBudget, buildAdaptiveResponseInstruction, cleanAlphaResponse, extractAlphaDirective } from "../utils/alphaBrain.js";
import { AI_FEATURE_CATEGORIES, AI_FEATURE_COMMANDS, getAiFeature } from "../utils/alphaFeatureCatalog.js";

test("Alpha exposes 24 inline answer modes", () => {
  const modes = ["brief","concise","deep","steps","eli5","beginner","expert","formal","direct","coach","tutor","analyst","developer","compare","brainstorm","critique","checklist","example","quiz","creative","whatsapp","rewrite","explain","action"];
  for (const mode of modes) {
    const result = extractAlphaDirective(mode + ": test this");
    assert.equal(result.mode, mode);
    assert.equal(result.prompt, "test this");
    assert.ok(result.instruction.length > 10);
  }
});

test("Alpha adaptive response engine recognizes troubleshooting and writing intents", () => {
  const debug = buildAdaptiveResponseInstruction("fix this Render deployment error", {
    replyLength: "balanced", replyFormat: "steps", emojiLevel: "low", expertise: "expert", answerMode: "developer",
  });
  assert.match(debug, /troubleshooting/i);
  assert.match(debug, /verification step/i);
  assert.match(debug, /technically precise/i);
  assert.match(debug, /senior engineering pair-partner/i);
  const writing = buildAdaptiveResponseInstruction("rewrite this message for WhatsApp", {});
  assert.match(writing, /finished text first/i);
});

test("Alpha output budget adapts to reply depth", () => {
  assert.equal(alphaResponseTokenBudget({ prompt: "hi", directiveMode: "brief", preferences: {} }), 480);
  assert.equal(alphaResponseTokenBudget({ prompt: "x", directiveMode: "deep", preferences: {} }), 1500);
  assert.equal(alphaResponseTokenBudget({ prompt: "x", directiveMode: "auto", preferences: { replyLength: "detailed" } }), 1500);
  assert.equal(alphaResponseTokenBudget({ prompt: "x", directiveMode: "auto", preferences: { replyLength: "short" } }), 480);
});

test("Alpha response cleanup removes filler, headings and duplicate long lines", () => {
  const cleaned = cleanAlphaResponse("Sure! ### Result\nThis is a useful repeated sentence.\nThis is a useful repeated sentence.", "Alpha");
  assert.doesNotMatch(cleaned, /^Sure/i);
  assert.match(cleaned, /\*Result\*/);
  assert.equal((cleaned.match(/This is a useful repeated sentence\./g) || []).length, 1);
});

test("Alpha workflow pack contains at least 120 new collision-free workflows", () => {
  assert.ok(AI_FEATURE_COMMANDS.length >= 280, "Expected at least 280 workflows");
  assert.equal(new Set(AI_FEATURE_COMMANDS).size, AI_FEATURE_COMMANDS.length);
  for (const category of ["creator_build","software_quality","study_mastery","conversation_plus","social_fun","thinking_tools","life_admin","content_creator","group_community","career_growth","idea_lab","answer_quality"]) {
    assert.equal(AI_FEATURE_CATEGORIES[category]?.length, 10, category);
  }
  assert.match(getAiFeature("aibugtriage").instruction, /bug report/i);
  assert.match(getAiFeature("aimvpplan").instruction, /minimum viable product/i);
  assert.match(getAiFeature("aifeedbackanalysis").instruction, /user feedback/i);
});

test("Alpha member response controls expose persistent preference commands", () => {
  const source = readFileSync(new URL("../commands/public/memberStyle.js", import.meta.url), "utf8");
  for (const command of ["mylength","myformat","myemoji","myexpertise","mymode","alphamodes"]) {
    assert.match(source, new RegExp('"' + command + '"'));
  }
  assert.match(source, /replyLength/);
  assert.match(source, /answerMode/);
});
