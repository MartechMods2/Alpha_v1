import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setup } from "./helpers/auraStore.js";
import { isAuraEnabled, setAuraEnabled } from "../utils/aura/activation.js";
import { createAuraChargeRunner } from "../utils/aura/charging.js";
import { auraMemberGuide } from "../utils/aura/memberGuide.js";
const owner = "2348000000000@s.whatsapp.net",
  member = "2348000000001@s.whatsapp.net";
test("missing activation setting is OFF and only explicit boolean true enables", async () => {
  const { store } = setup();
  assert.equal(await isAuraEnabled(store), false);
  for (const enabled of [false, "true", 1, null]) {
    await store.put("AuraSettings", { _id: "economy", enabled });
    assert.equal(await isAuraEnabled(store), false);
  }
  await store.put("AuraSettings", { _id: "economy", enabled: true });
  assert.equal(await isAuraEnabled(store), true);
});
test("only the configured creator can persist activation and deactivation", async () => {
  const { store, engine } = setup();
  await assert.rejects(
    setAuraEnabled(store, true, member, engine.owned),
    /creator/,
  );
  await setAuraEnabled(store, true, owner, engine.owned);
  assert.equal(await isAuraEnabled(store), true);
  await setAuraEnabled(store, false, owner, engine.owned);
  assert.equal(await isAuraEnabled(store), false);
});
test("OFF runs ordinary commands without reserving, requiring Aura or asking cost confirmation", async () => {
  let executed = 0;
  const run = createAuraChargeRunner({
    isEnabled: async () => false,
    getEngine: () => assert.fail("no wallet lookup when off"),
    identify: () => assert.fail("no Aura identity lookup"),
  });
  const r = await run(
    async () => {
      executed++;
      return "ordinary result";
    },
    null,
    {},
    "g",
    [],
    { command: "img" },
  );
  assert.equal(r, "ordinary result");
  assert.equal(executed, 1);
});
test("unknown database activation state does not bypass charging", async () => {
  let text;
  const run = createAuraChargeRunner({
    isEnabled: async () => {
      throw Error("private database credentials");
    },
    getEngine: () => assert.fail(),
    identify: () => assert.fail(),
  });
  await run(
    () => assert.fail("must not run when activation cannot be read"),
    null,
    {},
    "g",
    [],
    {
      command: "alpha",
      sendMessageWTyping: async (_, p) => {
        text = p.text;
      },
    },
  );
  assert.match(text, /could not complete/);
  assert.ok(!text.includes("credentials"));
});
test("member guide covers the economy in bounded complete pages and respects prefix", () => {
  const pages = auraMemberGuide("!");
  assert.equal(pages.length, 3);
  for (const p of pages) assert.ok(p.length < 4000);
  const all = pages.join("\n");
  for (const term of [
    "!daily",
    "!redeem",
    "!prices",
    "--confirm",
    "5%",
    "!evo",
    "!auraappeal",
    "conduct",
    "OFF",
    "20,000",
    "500,000",
  ])
    assert.ok(all.includes(term), term);
});
async function loadCommand(fixture) {
  globalThis.__auraActivation = fixture;
  const url = new URL("../commands/public/aura.js", import.meta.url);
  let source = await readFile(url, "utf8");
  source = source.replace(/from "([^"]+)"/g, (whole, path) => {
    if (path.endsWith("db/auraData.js"))
      return `from "data:text/javascript;base64,${Buffer.from("export const aura=globalThis.__auraActivation.engine;export const auraStore=globalThis.__auraActivation.store;//" + Math.random()).toString("base64")}"`;
    return path.startsWith(".") ? `from "${new URL(path, url).href}"` : whole;
  });
  return (
    await import(
      `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`
    )
  ).default();
}
test("command flow defaults off, denies moderator activation, allows owner on/off and group announcement", async () => {
  const fixture = setup();
  fixture.setTime(new Date());
  const sent = [];
  try {
    const command = await loadCommand(fixture);
    const run = (actor, cmd, args = []) =>
      command.handler(
        {},
        { key: { id: cmd + args.join("") } },
        "12345@g.us",
        args,
        {
          senderJid: actor,
          command: cmd,
          isGroup: true,
          isOwner: true,
          isModerator: true,
          sendMessageWTyping: async (to, p) => sent.push({ to, ...p }),
        },
      );
    await run(member, "daily");
    assert.match(sent.at(-1).text, /currently OFF/);
    assert.equal((await fixture.engine.profile(member)).balance, 0);
    await run(member, "aurasystem", ["on"]);
    assert.match(sent.at(-1).text, /Only the primary/);
    assert.equal(await isAuraEnabled(fixture.store), false);
    await run(owner, "aurasystem", ["on"]);
    assert.equal(await isAuraEnabled(fixture.store), true);
    await run(member, "daily");
    assert.equal((await fixture.engine.profile(member)).balance, 500);
    await run(owner, "aurasystem", ["off"]);
    await run(member, "quests");
    assert.match(sent.at(-1).text, /currently OFF/);
    assert.equal((await fixture.engine.profile(member)).balance, 500);
    const previous = sent.length;
    await run(owner, "auraannounce");
    assert.equal(sent.length - previous, 4);
    assert.match(sent[previous].text, /SYSTEM: OFF/);
    await run(member, "auraannounce");
    assert.match(sent.at(-1).text, /Only the creator/);
    await run(member, "auraguide", ["3"]);
    assert.match(sent.at(-1).text, /RANKS & FAIR PLAY/);
  } finally {
    delete globalThis.__auraActivation;
  }
});
