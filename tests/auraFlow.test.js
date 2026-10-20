import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setup } from "./helpers/auraStore.js";
import { auraIdentity } from "../utils/aura/identity.js";
import { learningQuest } from "../utils/aura/quests.js";
import { key, dayKey, seasonKey } from "../utils/aura/policy.js";
const owner = "2348000000000@s.whatsapp.net",
  a = "2348000000001@s.whatsapp.net",
  b = "2348000000002@s.whatsapp.net";
async function load(file) {
  const url = new URL(file, import.meta.url);
  let source = await readFile(url, "utf8");
  source = source.replace(/from "([^"]+)"/g, (whole, path) => {
    if (path.endsWith("db/auraData.js"))
      return `from "data:text/javascript;base64,${Buffer.from("export const aura=globalThis.__auraFlow.engine;export const auraStore=globalThis.__auraFlow.store;//" + Math.random()).toString("base64")}"`;
    return path.startsWith(".") ? `from "${new URL(path, url).href}"` : whole;
  });
  return (
    await import(
      `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`
    )
  ).default();
}
test("Aura identities unify PN and LID aliases, reject unknown mappings and ignore role flags", async () => {
  const info = {
    senderJid: "12345678@lid",
    isOwner: true,
    groupMetadata: { participants: [{ id: "12345678@lid", phoneNumber: a }] },
  };
  assert.equal(await auraIdentity({}, info), a);
  assert.equal(
    await auraIdentity({}, { ...info, senderJid: a.replace("@", ":4@") }),
    a,
  );
  await assert.rejects(
    auraIdentity({}, { senderJid: "99887766@lid", isOwner: true }),
    /cannot verify/,
  );
});
test("learning quests are stable on replay and daily slots use different questions", () => {
  const first = learningQuest(a, "2026-10-20", "1"),
    second = learningQuest(a, "2026-10-20", "2");
  assert.deepEqual(learningQuest(a, "2026-10-20", "1"), first);
  assert.notEqual(first.prompt, second.prompt);
  assert.equal(new Set(first.options).size, 3);
  assert.ok(first.answer >= 1 && first.answer <= 3);
});
test("commands keep gifts creator-only, coupons and transaction histories private", async () => {
  const fixture = setup();
  fixture.setTime(new Date());
  await fixture.store.put("AuraSettings", { _id: "economy", enabled: true });
  globalThis.__auraFlow = fixture;
  try {
    const command = await load("../commands/public/aura.js"),
      sent = [];
    const sock = {
      profilePictureUrl: async () => {
        throw Error("private");
      },
    };
    let eventSequence = 0;
    const run = async (
      actor,
      cmd,
      args = [],
      target = b,
      id = `${cmd}-${++eventSequence}`,
    ) =>
      command.handler(sock, { key: { id } }, "12345@g.us", args, {
        senderJid: actor,
        isGroup: true,
        isOwner: true,
        isModerator: true,
        command: cmd,
        extendedMessageOriginal: { mentionedJid: [target] },
        sendMessageWTyping: async (to, p) => sent.push({ to, ...p }),
      });
    await run(a, "auragift", ["@member", "20000"]);
    assert.match(sent.at(-1).text, /Only the configured creator/);
    assert.equal((await fixture.engine.profile(b)).balance, 0);
    await run(owner, "auragift", ["@member", "20000"]);
    assert.equal((await fixture.engine.profile(b)).balance, 20000);
    await run(owner, "auracoupon", ["100"]);
    assert.equal(sent.at(-2).to, owner);
    assert.match(sent.at(-2).text, /Private Aura coupon/);
    assert.ok(!sent.at(-1).text.includes("Value:"));
    await run(b, "transactions");
    assert.equal(sent.at(-1).to, b);
    assert.match(sent.at(-1).text, /gift-received/);
    await run(owner, "auradrops", ["on"]);
    assert.deepEqual(
      (await fixture.store.get("AuraSettings", "drops")).groups,
      ["12345@g.us"],
    );
    await run(b, "balance");
    assert.ok(sent.at(-1).image);
    assert.match(sent.at(-1).caption, /20000/);
    assert.ok(!sent.at(-1).caption.includes("∞"));
    await run(b, "aurabuy", ["tagline-ticket"]);
    await run(b, "aurause", ["tagline-ticket", "Hello", "community"]);
    assert.equal((await fixture.engine.profile(b)).tagline, "Hello community");
    await run(b, "aurapreview", ["ruby-frame"]);
    assert.ok(sent.at(-1).image);
    assert.match(sent.at(-1).caption, /PREVIEW ONLY/);
    assert.equal((await fixture.engine.profile(b)).balance, 19000);
    await run(b, "auracollect");
    assert.ok(sent.at(-1).image);
    assert.match(sent.at(-1).caption, /Collected/);
    await run(b, "aurashop", ["all", "2"]);
    assert.ok(sent.at(-1).image);
    assert.match(sent.at(-1).caption, /2\/7/);
    const fundedWallet = await fixture.engine.profile(b);
    fundedWallet.balance += 120000;
    await fixture.store.put("AuraWallets", fundedWallet);
    await run(b, "aurabag", ["expand"]);
    assert.match(sent.at(-1).text, /--confirm/);
    assert.equal((await fixture.engine.profile(b)).balance, 139000);
    await run(b, "aurabag", ["expand", "--confirm"]);
    assert.equal((await fixture.engine.profile(b)).bagSlots, 24);
    await run(b, "aurabuy", ["byte-fox"]);
    await run(b, "aurapet", ["equip", "byte-fox"]);
    await run(b, "aurabuy", ["pet-treat"]);
    await run(b, "aurause", ["pet-treat"]);
    assert.match(sent.at(-1).text, /Bond: 1/);
    await run(owner, "aurasystem", ["off"]);
    await run(b, "aurabuy", ["ruby-frame"]);
    assert.match(sent.at(-1).text, /currently OFF/);
    assert.equal((await fixture.engine.profile(b)).balance, 10700);
    await run(b, "aurabag", ["expand", "--confirm"]);
    assert.match(sent.at(-1).text, /OFF/);
  } finally {
    delete globalThis.__auraFlow;
  }
});
test("ranked invitation requires opponent consent; one verified result credits once", async () => {
  const fixture = setup();
  fixture.setTime(new Date());
  await fixture.store.put("AuraSettings", { _id: "economy", enabled: true });
  globalThis.__auraFlow = fixture;
  try {
    const command = await load("../commands/group/members/auraArena.js");
    const sent = [];
    const run = async (actor, cmd, args = []) =>
      command.handler({}, { key: { id: cmd } }, "12345@g.us", args, {
        senderJid: actor,
        isGroup: true,
        command: cmd,
        extendedMessageOriginal: { mentionedJid: [b] },
        sendMessageWTyping: async (_, p) => sent.push(p.text),
      });
    await run(a, "auraduel");
    await run(a, "auraaccept");
    assert.match(sent.at(-1), /No valid invitation/);
    await run(b, "auraaccept");
    const id = key("duel-group", "12345@g.us");
    const row = await fixture.store.get("AuraDuels", id);
    await run(a, "auraanswer", [row.answers[0]]);
    assert.match(sent.at(-1), /Correct answer/);
    assert.equal((await fixture.engine.profile(a)).balance, 1000);
    await run(a, "auraanswer", [row.answers[0]]);
    assert.equal((await fixture.engine.profile(a)).balance, 1000);
  } finally {
    delete globalThis.__auraFlow;
  }
});
test("conduct penalties restrict paid features without locking daily recovery or safety commands", async () => {
  const { engine: e, store } = setup();
  await e.gift(owner, a, 10000, "g");
  const w = await e.profile(a);
  w.conduct = 30;
  await store.put("AuraWallets", w);
  await assert.rejects(e.charge(a, "alpha", 500, "c"), /Conduct/);
  await e.daily(a);
  assert.equal((await e.profile(a)).conduct, 31);
});
test("season rollover preserves Aura, XP and previous best while first loss is protected", async () => {
  const { engine: e, store, setTime } = setup();
  await e.gift(owner, a, 5000, "gift");
  for (const who of [a, b]) {
    const w = await e.profile(who);
    Object.assign(w, { season: "2026-09", rp: 900, bestRp: 1200, xp: 1000 });
    await store.put("AuraWallets", w);
  }
  setTime("2026-10-20T12:00:00Z");
  await store.put("AuraDuels", {
    _id: "d",
    matchId: "m",
    state: "result",
    winner: a,
    loser: b,
  });
  const r = await e.ranked(a, b, "m", "d");
  assert.equal(r.protectedLoss, true);
  assert.equal(r.loserRp, 300);
  assert.equal((await e.profile(a)).previousBest, 1200);
  assert.equal((await e.profile(a)).xp, 1100);
  assert.equal((await e.profile(a)).balance, 6000);
});

test("drop scheduler posts one shared code once per group and recovers stale reservations", async () => {
  let enabled = true;
  const instant = new Date("2026-10-20T07:01:00Z"),
    sent = [],
    recovered = [];
  const coupon = {
    _id: "drop",
    code: "0123456789ABCDEF",
    status: "open",
    groups: ["12345@g.us"],
    posted: [],
    expiresAt: new Date(+instant + 1800000),
  };
  const store = {
    find: async (name) =>
      name === "AuraCharges" ? [{ actor: a, _id: "stale" }] : [],
    get: async (name, id) =>
      id === "economy"
        ? { enabled }
        : name === "AuraSettings"
          ? { groups: ["12345@g.us", "malformed"] }
          : coupon,
    transaction: async (fn) =>
      fn({ get: async () => coupon, put: async () => {} }),
  };
  const engine = {
    settle: async (...args) => recovered.push(args),
    createDrop: async (slot) => {
      assert.equal(slot, "2026-10-20:8");
      return coupon;
    },
  };
  globalThis.__auraFlow = { engine, store };
  try {
    const url = new URL("../utils/aura/scheduler.js", import.meta.url);
    let source = await readFile(url, "utf8");
    source = source.replace(/from "([^"]+)"/g, (whole, path) => {
      if (path.endsWith("db/auraData.js"))
        return `from "data:text/javascript,export const aura={};export const auraStore={};"`;
      return path.startsWith(".") ? `from "${new URL(path, url).href}"` : whole;
    });
    const { checkAuraSchedules } = await import(
      `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
    );
    const deps = {
      engine,
      store,
      now: instant,
      sock: {
        user: {},
        alphaConnected: true,
        sendMessage: async (to, p) => sent.push({ to, ...p }),
      },
      queue: { enqueue: async (_to, fn) => fn() },
    };
    await checkAuraSchedules(deps);
    await checkAuraSchedules(deps);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "12345@g.us");
    assert.match(sent[0].text, /0123456789ABCDEF/);
    assert.equal(recovered.length, 2);
    enabled = false;
    await checkAuraSchedules(deps);
    assert.equal(sent.length, 1, "disabled economy never broadcasts new drops");
    assert.equal(
      recovered.length,
      3,
      "stale reservations still recover while disabled",
    );
  } finally {
    delete globalThis.__auraFlow;
  }
});
test("grouped Aura commands preserve activation gates, high-price confirmation and prestige entitlements", async () => {
  const fixture = setup();
  globalThis.__auraFlow = fixture;
  try {
    const command = await load("../commands/public/aura.js"),
      sent = [];
    let sequence = 0;
    const run = (cmd, args = []) =>
      command.handler(
        {
          profilePictureUrl: async () => {
            throw Error("private");
          },
        },
        { key: { id: "grouped-" + ++sequence } },
        "12345@g.us",
        args,
        {
          command: cmd,
          senderJid: b,
          isGroup: true,
          isOwner: true,
          isModerator: true,
          sendMessageWTyping: async (to, p) => sent.push({ to, ...p }),
        },
      );
    await run("aurashop", ["buy", "ruby-frame", "--confirm"]);
    assert.match(sent.at(-1).text, /OFF/);
    await run("evo");
    assert.match(sent.at(-1).text, /Evo-Legendary/);
    await run("evo", ["upgrade", "--confirm"]);
    assert.match(sent.at(-1).text, /OFF/);
    await fixture.store.put("AuraSettings", { _id: "economy", enabled: true });
    await fixture.store.put("AuraWallets", {
      ...(await fixture.engine.profile(b)),
      balance: 2000000,
    });
    await run("aurashop", ["buy", "ruby-frame"]);
    assert.match(sent.at(-1).text, /Confirm purchase/);
    assert.equal((await fixture.engine.profile(b)).balance, 2000000);
    await run("aurashop", ["buy", "ruby-frame", "--confirm"]);
    assert.equal((await fixture.engine.profile(b)).balance, 1400000);
    await run("aurashop", ["equip", "legendary-infinity-frame"]);
    assert.match(sent.at(-1).text, /Choose a cosmetic/);
    await run("aurashop", ["equip", "ruby-frame"]);
    assert.match(sent.at(-1).text, /updated/);
    await run("aura", ["inventory"]);
    assert.match(sent.at(-1).text, /ruby-frame/);
    await run("aura", ["bag"]);
    assert.match(sent.at(-1).text, /1\/20/);
    await run("aura", ["history"]);
    assert.equal(sent.at(-1).to, b);
    await run("aurashop", ["legendary"]);
    assert.ok(sent.at(-1).image);
    assert.match(sent.at(-1).caption, /Evo-Legendary\+ required/);
    const w = await fixture.engine.profile(b);
    w.evo = 6;
    w.quests = 500;
    await fixture.store.put("AuraWallets", w);
    await run("aurashop", ["equip", "legendary-infinity-frame"]);
    assert.match(sent.at(-1).text, /updated/);
    assert.equal(
      (await fixture.engine.profile(b)).equipped,
      "legendary-infinity-frame",
    );
  } finally {
    delete globalThis.__auraFlow;
  }
});
test("one entry point supports confirmed sharing, item gifts and thanks without activation bypass", async () => {
  const fixture = setup();
  globalThis.__auraFlow = fixture;
  try {
    const command = await load("../commands/public/aura.js"),
      sent = [];
    assert.deepEqual(command.cmd.slice(0, 3), ["aura", "aurashop", "evo"]);
    let sequence = 0;
    const run = (actor, cmd, args = [], id = "social-" + ++sequence) =>
      command.handler({}, { key: { id } }, "12345@g.us", args, {
        command: cmd,
        senderJid: actor,
        isGroup: true,
        isOwner: true,
        isModerator: true,
        extendedMessageOriginal: { mentionedJid: [b] },
        sendMessageWTyping: async (to, p) => sent.push({ to, ...p }),
      });
    await run(a, "aura", ["shop", "gift", "@member", "byte-fox", "--confirm"]);
    assert.match(sent.at(-1).text, /OFF/);
    await run(a, "aura", ["thanks", "@member"]);
    assert.match(sent.at(-1).text, /OFF/);
    await fixture.store.put("AuraSettings", { _id: "economy", enabled: true });
    await fixture.store.put("AuraWallets", {
      ...(await fixture.engine.profile(a)),
      balance: 20000,
      inventory: ["byte-fox"],
      purchaseCosts: { "byte-fox": 8000 },
    });
    await run(a, "aura", ["send", "@member", "1000"]);
    assert.match(sent.at(-1).text, /fee 50/);
    assert.equal((await fixture.engine.profile(a)).balance, 20000);
    await run(a, "aura", ["send", "@member", "1000", "--confirm"], "send-once");
    assert.equal((await fixture.engine.profile(a)).balance, 18950);
    assert.equal((await fixture.engine.profile(b)).balance, 1000);
    const privateCount = sent.filter((x) => x.to === b).length;
    await run(a, "aura", ["send", "@member", "1000", "--confirm"], "send-once");
    assert.equal(sent.filter((x) => x.to === b).length, privateCount);
    await run(a, "aura", ["shop", "gift", "@member", "byte-fox"]);
    assert.match(sent.at(-1).text, /Gift ONE/);
    assert.deepEqual((await fixture.engine.profile(a)).inventory, ["byte-fox"]);
    await run(a, "aura", ["shop", "gift", "@member", "byte-fox", "--confirm"]);
    assert.match(sent.at(-1).text, /GIFT DELIVERED/);
    assert.deepEqual((await fixture.engine.profile(b)).inventory, ["byte-fox"]);
    await run(a, "aura", ["thanks", "@member"]);
    assert.match(sent.at(-1).text, /SPOTLIGHT/);
    assert.equal((await fixture.engine.profile(b)).kudos, 1);
    await run(owner, "aura", ["send", "@member", "25000"]);
    assert.match(sent.at(-1).text, /fee 0/);
    await run(owner, "aura", ["send", "@member", "25000", "--confirm"]);
    assert.equal((await fixture.engine.profile(b)).balance, 26000);
  } finally {
    delete globalThis.__auraFlow;
  }
});
test("Aura help advertises a single entry point without exposing the long compatibility alias list", async () => {
  const fixture = setup();
  globalThis.__auraFlow = fixture;
  try {
    const auraCommand = await load("../commands/public/aura.js");
    const url = new URL("../commands/public/help.js", import.meta.url);
    let source = await readFile(url, "utf8");
    const catalogue = {
      publicCommands: [
        {
          cmd: auraCommand.cmd,
          desc: auraCommand.desc,
          usage: auraCommand.usage,
        },
      ],
      groupCommands: [],
    };
    source = source.replace(/from "([^"]+)"/g, (whole, path) => {
      if (path.endsWith("utils/commandLoader.js"))
        return `from "data:text/javascript;base64,${Buffer.from("export const cmdToText=async()=>(" + JSON.stringify(catalogue) + ");").toString("base64")}"`;
      return path.startsWith(".") ? `from "${new URL(path, url).href}"` : whole;
    });
    const command = (
        await import(
          `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
        )
      ).default(),
      sent = [];
    await command.handler({}, { key: { id: "help" } }, "group", ["aura"], {
      sendMessageWTyping: async (to, p) => sent.push(p),
    });
    assert.match(sent.at(-1).text, /One entry point/);
    assert.ok(!sent.at(-1).text.includes("Aliases:"));
    assert.ok(!sent.at(-1).text.includes("$aurapenalty"));
  } finally {
    delete globalThis.__auraFlow;
  }
});
test("reviewed routing and sharing reject ambiguity and expose safe short help and item history", async () => {
  const f = setup();
  globalThis.__auraFlow = f;
  try {
    const command = await load("../commands/public/aura.js"),
      sent = [];
    let i = 0;
    const run = (actor, args, mentions = [b]) =>
      command.handler(
        {},
        { key: { id: "review-" + ++i } },
        "12345@g.us",
        args,
        {
          command: "aura",
          senderJid: actor,
          isGroup: true,
          extendedMessageOriginal: { mentionedJid: mentions },
          sendMessageWTyping: async (to, p) => sent.push({ to, ...p }),
        },
      );
    await run(a, ["help"]);
    assert.match(sent.at(-1).text, /SIMPLE MEMBER GUIDE/);
    await run(a, ["constructor"]);
    assert.match(sent.at(-1).text, /Start with/);
    await run(a, ["shop", "toString"]);
    assert.match(sent.at(-1).text, /Use \$aurashop/);
    await f.store.put("AuraSettings", { _id: "economy", enabled: true });
    await f.store.put("AuraWallets", {
      ...(await f.engine.profile(a)),
      balance: 20000,
      inventory: ["byte-fox", "cloud-cat"],
    });
    await run(a, ["send", "@one", "@two", "1000", "--confirm"], [b, owner]);
    assert.match(sent.at(-1).text, /one recipient/);
    await run(a, ["send", "@member", "1000", "2000", "--confirm"]);
    assert.match(sent.at(-1).text, /exactly one/);
    await run(a, [
      "shop",
      "gift",
      "@member",
      "byte-fox",
      "cloud-cat",
      "--confirm",
    ]);
    assert.match(sent.at(-1).text, /exactly one/);
    assert.equal((await f.engine.profile(a)).balance, 20000);
    assert.equal((await f.engine.profile(a)).inventory.length, 2);
    await run(a, ["send", "@member", "1000"]);
    assert.deepEqual(sent.at(-1).mentions, [b]);
    assert.match(sent.at(-1).text, /gets 1000/);
    await run(a, ["shop", "gift", "@member", "byte-fox", "--confirm"]);
    await run(b, ["history"]);
    assert.equal(sent.at(-1).to, b);
    assert.match(sent.at(-1).text, /Item: byte-fox/);
  } finally {
    delete globalThis.__auraFlow;
  }
});
