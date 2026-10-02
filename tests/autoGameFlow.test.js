import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash, createHmac, createCipheriv } from "node:crypto";
import { proto } from "baileys";
import { parseHostedOptions } from "../utils/hostedGameOptions.js";
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mockedModule = async (path, mocks) => {
  const url = new URL(path, import.meta.url);
  const source = await readFile(url, "utf8");
  return asModule(source.replace(/from "([^"]+)"/g, (_match, specifier) => `from "${mocks[specifier] || new URL(specifier, url).href}"`));
};

test("hosted options accept positional and explicit rounds without silently reverting to two", () => {
  assert.deepEqual(parseHostedOptions(["trivia", "tech", "rounds=12", "lobby=2m"]), { rounds: 12, lobbyMs: 120_000, rest: ["trivia", "tech"] });
  assert.equal(parseHostedOptions(["mathgame", "100"]).rounds, 100);
  assert.throws(() => parseHostedOptions(["rounds=abc"]), /Choose 1–100/);
});

test("all ten games auto-enrol an admin, count poll votes, play repeated rounds and announce a winner", async t => {
  const h = { snapshots: new Map(), polls: new Map(), results: new Map(), timers: [], sent: [] };
  globalThis.__alphaAutoFlow = h;
  t.after(() => { delete globalThis.__alphaAutoFlow; });
  t.mock.method(globalThis, "setTimeout", (callback, delay) => { const timer = { callback, delay, unref() {} }; h.timers.push(timer); return timer; });
  t.mock.method(globalThis, "clearTimeout", () => {});
  const queue = asModule("export default {enqueue: async (_jid, send) => send()};");
  const participants = await mockedModule("../utils/groupParticipants.js", { baileys: asModule("export const jidNormalizedUser = jid => jid.replace(/:\\d+@/, '@');") });
  const pollDb = asModule(`
    const h = globalThis.__alphaAutoFlow;
    export async function createPollSession(row) { const p = structuredClone({...row, votes: [], status: 'open'}); h.polls.set(row._id, p); return p; }
    export async function getPollSession(id) { return h.polls.get(id); }
    export async function replacePollVote(id, voterJid, option) { const p = h.polls.get(id); p.votes = p.votes.filter(v => v.voterJid !== voterJid); if (option) p.votes.push({voterJid, option, votedAt: new Date()}); return p; }
    export async function closePollSession(id) { if (h.failClose) throw new Error("lobby read unavailable"); const p = h.polls.get(id); if (p) p.status = 'closed'; return p; }
  `);
  const pollsUrl = await mockedModule("../utils/pollManager.js", {
    "../db/pollSessionData.js": pollDb,
    "../db/groupTools.js": asModule("export async function setGroupBirthday() {}"),
    "../queue/messageQueue.js": queue,
    "./groupParticipants.js": participants,
  });
  const gameDb = asModule(`
    const h = globalThis.__alphaAutoFlow;
    export async function recordGameResult(row) { if (h.failResult) throw new Error('temporary score outage'); h.results.set(row.resultId, structuredClone(row)); return row; }
    export async function claimDailyChallenge() { return true; }
    export async function getGameLeaderboard() { return []; }
    export async function getGameProfile() { return null; }
    export async function getGroupGameStats() { return {}; }
    export async function getDailyChallengeClaim() { return null; }
  `);
  const hostUrl = await mockedModule("../utils/autoGameHost.js", {
    "../db/gameData.js": gameDb,
    "../db/autoGameData.js": asModule(`
      const h = globalThis.__alphaAutoFlow;
      export async function saveAutoGame(jid, row) { h.snapshots.set(jid, structuredClone(row)); }
      export async function readAutoGame(jid) { return h.snapshots.get(jid); }
      export async function listAutoGames() { return [...h.snapshots.values()]; }
      export async function deleteAutoGame(jid) { h.snapshots.delete(jid); }
    `),
    "./pollManager.js": pollsUrl,
    "./groupParticipants.js": participants,
    "../queue/messageQueue.js": queue,
  });
  const host = await import(hostUrl);
  const polls = await import(pollsUrl);
  const starter = "111@s.whatsapp.net";
  const guest = "222@s.whatsapp.net";
  const outsider = "333@s.whatsapp.net";
  const metadata = { participants: [{ id: starter, lid: "starter@lid" }, { id: guest, lid: "guest@lid" }, { id: outsider }] };
  let pollId = 0;
  const sock = { user: { id: "999@s.whatsapp.net", lid: "bot@lid" }, groupMetadata: async () => metadata, sendMessage: async (jid, content) => {
    h.sent.push({ jid, ...content });
    return { key: { remoteJid: jid, id: `auto-poll-${++pollId}` }, message: { pollCreationMessageV3: content.poll, messageContextInfo: { messageSecret: Buffer.alloc(32) } } };
  } };
  const vote = async (groupJid, id, jid) => {
    const secret = Buffer.alloc(32);
    const key0 = createHmac("sha256", Buffer.alloc(32)).update(secret).digest();
    const key = createHmac("sha256", key0).update(Buffer.concat([
      Buffer.from(id), Buffer.from(sock.user.lid), Buffer.from(jid), Buffer.from("Poll Vote"), Buffer.from([1]),
    ])).digest();
    const encIv = Buffer.alloc(12, 7);
    const cipher = createCipheriv("aes-256-gcm", key, encIv);
    cipher.setAAD(Buffer.from(`${id}\0${jid}`));
    const payload = proto.Message.PollVoteMessage.encode({ selectedOptions: [createHash("sha256").update("✅ Join game").digest()] }).finish();
    const encPayload = Buffer.concat([cipher.update(payload), cipher.final(), cipher.getAuthTag()]);
    await polls.handleInteractivePollMessage(sock, {
      key: { remoteJid: groupJid, id: `${id}-vote`, participant: jid },
      message: { pollUpdateMessage: { pollCreationMessageKey: { id, remoteJid: groupJid, fromMe: true }, vote: { encIv, encPayload }, senderTimestampMs: Date.now() } },
    });
  };
  for (const game of host.AUTO_GAMES) {
    const groupJid = `${game}@g.us`;
    await host.startAutoGame({ sock, groupJid, senderJid: starter, name: "Admin", metadata, args: [game, "rounds=2", "lobby=2m"] });
    const session = host.getAutoGameSession(groupJid);
    assert.equal(session.players.length, 1);
    await vote(groupJid, session.pollId, "guest@lid");
    assert.equal(session.players.length, 2, `${game}: native vote immediately counts`);
    assert.match(host.autoGameStatus(groupJid), /Players: \*2\/20/);
    assert.match(await host.controlAutoGame({ sock, groupJid, senderJid: outsider, action: "close" }), /Only the starter/);
    const lobbyTimer = h.timers.at(-1);
    assert.equal(lobbyTimer.delay, 120_000);
    await lobbyTimer.callback();
    assert.equal(session.status, "playing");
    let turns = 0;
    while (host.getAutoGameSession(groupJid)) {
      const player = session.players.find(row => row.jid === session.order[session.index]);
      assert.equal(await host.answerAutoGame({ sock, groupJid, senderJid: outsider, answer: session.question.answers[0] }), false);
      // PN/LID aliases must resolve to the same current player.
      const senderJid = player.jid === starter ? "starter@lid" : "guest@lid";
      await host.answerAutoGame({ sock, groupJid, senderJid, answer: player.jid === starter ? session.question.answers[0] : "skip" });
      assert.ok(++turns <= 4);
    }
    assert.equal(turns, 4);
    const results = [...h.results.values()].filter(row => row.groupJid === groupJid);
    assert.equal(results.length, 4);
    assert.equal(results.filter(row => row.memberJid === starter).every(row => row.points > 0), true);
    assert.equal(results.filter(row => row.memberJid === guest).every(row => row.points === 0), true);
    assert.match(h.sent.at(-1).text, /Hosted Game Complete/);
    assert.match(h.sent.at(-1).text, /Winner: 🏆 Admin/);
    assert.equal(h.snapshots.has(groupJid), false);
  }

  const commandUrl = await mockedModule("../commands/group/members/scoredGames.js", {
    "../../../utils/autoGameHost.js": hostUrl,
    "../../../utils/truthDareHost.js": asModule("export async function restoreTruthDareSession() {return null;}"),
    "../../../queue/messageQueue.js": queue,
    "../../../db/gameData.js": gameDb,
    "../../../utils/pollManager.js": pollsUrl,
  });
  const command = await import(commandUrl);
  const routingGroup = "routing@g.us";
  const info = { command: "game", senderJid: starter, updateName: "Admin", groupMetadata: metadata, sendMessageWTyping: sock.sendMessage };
  await command.default().handler(sock, {}, routingGroup, ["random", "trivia", "rounds=2", "lobby=90s"], info);
  assert.equal(host.getAutoGameSession(routingGroup).rounds, 2);
  await command.default().handler(sock, {}, routingGroup, ["join"], { ...info, senderJid: guest });
  await command.default().handler(sock, {}, routingGroup, ["close"], info);
  const routingSession = host.getAutoGameSession(routingGroup);
  await command.default().handler(sock, {}, routingGroup, ["answer", ...routingSession.question.answers[0].split(" ")], { ...info, senderJid: routingSession.order[0] });
  assert.equal(routingSession.index, 1, "$game answer reaches the automatic host");
  await command.handlePassiveScoredGameAnswer({ sock, from: routingGroup, msg: {}, senderJid: routingSession.order[1], answer: routingSession.question.answers[0] });
  assert.equal(routingSession.round, 2, "passive #answers reach the automatic host");
  await command.default().handler(sock, {}, routingGroup, ["stop"], info);
  assert.equal(host.getAutoGameSession(routingGroup), null);

  // A question-send failure must retain a timed, recoverable answer phase.
  const sendFailureGroup = "send-failure@g.us";
  const flakySock = { ...sock, sendMessage: async (jid, content) => {
    if (h.failQuestion && content.text?.includes("🎯")) throw new Error("question send failed");
    return sock.sendMessage(jid, content);
  } };
  await host.startAutoGame({ sock: flakySock, groupJid: sendFailureGroup, senderJid: starter, metadata, args: ["trivia"] });
  await host.controlAutoGame({ sock: flakySock, groupJid: sendFailureGroup, senderJid: guest, action: "join" });
  h.failQuestion = true;
  await assert.rejects(host.controlAutoGame({ sock: flakySock, groupJid: sendFailureGroup, senderJid: starter, action: "close" }), /question send failed/);
  assert.ok(host.getAutoGameSession(sendFailureGroup).timer);
  assert.equal(h.snapshots.get(sendFailureGroup).phase, "delivery");
  h.failQuestion = false;
  const waitingQuestion = host.getAutoGameSession(sendFailureGroup).question;
  await h.timers.at(-1).callback();
  assert.equal(host.getAutoGameSession(sendFailureGroup).phase, "answer");
  assert.deepEqual(host.getAutoGameSession(sendFailureGroup).question, waitingQuestion, "retry delivers the same question without forfeiting the turn");
  assert.equal(host.getAutoGameSession(sendFailureGroup).index, 0);
  await host.controlAutoGame({ sock: flakySock, groupJid: sendFailureGroup, senderJid: starter, action: "stop" });

  const groupJid = "recovery@g.us";
  await host.startAutoGame({ sock, groupJid, senderJid: starter, metadata, args: ["trivia", "rounds=2", "lobby=90s"] });
  await host.controlAutoGame({ sock, groupJid, senderJid: guest, action: "join" });
  await host.controlAutoGame({ sock, groupJid, senderJid: starter, action: "close" });
  const session = host.getAutoGameSession(groupJid);
  const question = structuredClone(session.question);
  const recovered = await import(`${hostUrl}#restarted`);
  await recovered.restoreActiveAutoGames({ sock });
  assert.deepEqual(recovered.getAutoGameSession(groupJid).question, question, "restart preserves active question and scores");
  assert.ok(h.timers.at(-1).delay <= 60_000);
  await h.timers.at(-1).callback();
  assert.equal(recovered.getAutoGameSession(groupJid).index, 1, "recovered timeout advances automatically");
  const playing = recovered.getAutoGameSession(groupJid);
  h.failResult = true;
  await assert.rejects(recovered.answerAutoGame({ sock, groupJid, senderJid: playing.order[playing.index], answer: playing.question.answers[0] }), /score outage/);
  assert.ok(h.snapshots.get(groupJid).pendingResult, "earned score is saved pending a retry");
  h.failResult = false;
  const recoveredAgain = await import(`${hostUrl}#second-restart`);
  await recoveredAgain.restoreActiveAutoGames({ sock });
  await h.timers.at(-1).callback();
  assert.equal(recoveredAgain.getAutoGameSession(groupJid).round, 2);
  await recoveredAgain.controlAutoGame({ sock, groupJid, senderJid: starter, action: "stop" });
  assert.equal(recoveredAgain.getAutoGameSession(groupJid), null);
});
