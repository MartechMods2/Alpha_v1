import assert from "node:assert/strict";
import test from "node:test";
import createFunLab from "../commands/group/members/alphaFunLab.js";

test("Alpha Fun Lab exposes new unique creator-style commands", () => {
  const feature = createFunLab();
  assert.deepEqual(feature.cmd, [
    "aurafarm", "auracard",
    "glitchcard",
    "buildquest",
    "techprophecy",
    "mysterydrop",
    "vibecode",
    "funlab",
  ]);
  assert.match(feature.desc, /aura cards/i);
});

test("Alpha Fun Lab help is available without an AI provider", async () => {
  const feature = createFunLab();
  let sent = "";
  await feature.handler(
    null,
    { pushName: "Tester" },
    "group@g.us",
    [],
    {
      command: "funlab",
      senderJid: "123@s.whatsapp.net",
      updateName: "Tester",
      sendMessageWTyping: async (_to, payload) => { sent = payload.text; },
    },
  );
  assert.match(sent, /ALPHA FUN LAB/);
  assert.match(sent, /aurafarm/);
  assert.match(sent, /do not consume an AI-provider request/i);
});
