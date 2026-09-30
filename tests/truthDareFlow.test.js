import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { decodePollMessage, readCachedPollMessage } from "../utils/pollMessageStore.js";

const asModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const loadWithMocks = async (path, mocks) => {
  const url = new URL(path, import.meta.url);
  const source = await readFile(url, "utf8");
  return asModule(source.replace(/from "([^"]+)"/g, (_match, specifier) =>
    `from "${mocks[specifier] || new URL(specifier, url).href}"`));
};

test("poll votes survive a long lobby and drive automatic turns, scoring and winner", async (t) => {
  const h = { polls: new Map(), snapshots: new Map(), results: [], timers: [], sent: [] };
  globalThis.__alphaTdFlow = h;
  t.after(() => { delete globalThis.__alphaTdFlow; });
  t.mock.method(globalThis, "setTimeout", (callback, delay) => {
    const timer = { callback, delay, unref() {}, cleared: false };
    h.timers.push(timer);
    return timer;
  });
  t.mock.method(globalThis, "clearTimeout", (timer) => { if (timer) timer.cleared = true; });

  const pollDb = asModule(`
    const h = globalThis.__alphaTdFlow;
    export async function createPollSession(session) { const row = {...session, votes: [], status: 'open'}; h.polls.set(session._id, row); return row; }
    export async function getPollSession(id) { if (h.failRead) throw new Error('DB read unavailable'); return h.polls.get(id); }
    export async function replacePollVote(id, voterJid, option) { const p = h.polls.get(id); p.votes = p.votes.filter(v => v.voterJid !== voterJid); if (option) p.votes.push({voterJid, option}); return p; }
    export async function closePollSession(id) { if (h.failClose) throw new Error('DB close unavailable'); const p = h.polls.get(id); if (p) p.status = 'closed'; }
  `);
  const queue = asModule("export default { enqueue: async (_jid, send) => send() };");
  const participantsUrl = await loadWithMocks("../utils/groupParticipants.js", {
    "baileys": asModule("export const jidNormalizedUser = jid => jid.replace(/:\\d+@/, '@');"),
  });
  const pollUrl = await loadWithMocks("../utils/pollManager.js", {
    "../db/pollSessionData.js": pollDb,
    "../db/groupTools.js": asModule("export async function setGroupBirthday() {}"),
    "../queue/messageQueue.js": queue,
    "./groupParticipants.js": participantsUrl,
  });
  const hostUrl = await loadWithMocks("../utils/truthDareHost.js", {
    "../db/gameData.js": asModule("export async function recordGameResult(row) { const h = globalThis.__alphaTdFlow; if (h.failStats) throw new Error('score unavailable'); if (!h.results.some(item => item.resultId === row.resultId)) h.results.push(row); }"),
    "../db/truthDareData.js": asModule(`
      const h = globalThis.__alphaTdFlow;
      export async function saveTruthDareSessionSnapshot(id, row) { h.snapshots.set(id, structuredClone({...row, groupJid: id})); }
      export async function getTruthDareSessionSnapshot(id) { return h.snapshots.get(id); }
      export async function getActiveTruthDareSessionSnapshots() { return [...h.snapshots.values()]; }
      export async function deleteTruthDareSessionSnapshot(id) { h.snapshots.delete(id); }
      export async function recordTruthDareSessionPlayer() {}
      export async function getTruthDareLeaderboard() { return []; }
      export async function getTruthDareProfile() { return null; }
    `),
    "../queue/messageQueue.js": queue,
    "./pollManager.js": pollUrl,
    "./groupParticipants.js": participantsUrl,
    "./autoGameHost.js": asModule("export const getAutoGameSession = () => null; export const restoreAutoGame = async () => null;"),
  });
  const host = await import(hostUrl);
  const pollManager = await import(pollUrl);
  const groupJid = "td-flow@g.us";
  const starterJid = "111@s.whatsapp.net";
  const playerJid = "222@s.whatsapp.net";
  const metadata = { participants: [{ id: starterJid }, { id: playerJid }] };
  const secret = Buffer.alloc(32, 7);
  const sock = {
    user: { id: "999:1@s.whatsapp.net" },
    groupMetadata: async () => metadata,
    sendMessage: async (jid, content) => {
      h.sent.push(content);
      return { key: { remoteJid: jid, id: content.poll ? "poll-flow" : `message-${h.sent.length}` },
        message: content.poll ? { pollCreationMessageV3: content.poll, messageContextInfo: { messageSecret: secret } } : content };
    },
  };
  await host.startTruthDareSession({ sock, groupJid, starterJid, starterName: "Admin", groupMetadata: metadata, rounds: 10,
    lobbyMs: 600_000, sendMessageWTyping: sock.sendMessage });
  const session = host.getTruthDareSession(groupJid);
  assert.equal(session.participants.length, 1, "starter auto-enrolled");
  assert.equal(session.lobbyMs, 600_000);
  const pollKey = { remoteJid: groupJid, id: "poll-flow" };
  assert.deepEqual(readCachedPollMessage(pollKey).messageContextInfo.messageSecret, secret);
  const persistedMessage = decodePollMessage(h.polls.get("poll-flow").creationMessage);
  assert.deepEqual(persistedMessage.messageContextInfo.messageSecret, secret, "secret survives persistence");
  const actualPollDbUrl = await loadWithMocks("../db/pollSessionData.js", {
    "./client.js": asModule("export default {db: () => ({collection: () => ({findOne: async ({_id}) => globalThis.__alphaTdFlow.polls.get(_id)})})};"),
  });
  const actualPollDb = await import(actualPollDbUrl);
  assert.deepEqual((await actualPollDb.getPollCreationMessage(pollKey)).messageContextInfo.messageSecret, secret);
  assert.equal(await actualPollDb.getPollCreationMessage({ ...pollKey, remoteJid: "wrong@g.us" }), undefined);
  assert.match(h.sent[0].poll.name, /10 minutes/);

  await pollManager.handleInteractivePollUpdate(sock, { key: pollKey, update: { pollUpdates: [{
    pollUpdateMessageKey: { participantPn: playerJid },
    vote: { selectedOptions: [createHash("sha256").update("✅ Join game").digest()] },
  }] } });
  assert.equal(session.participants.length, 2, "vote counts immediately before lobby closes");
  h.failRead = true;
  h.failClose = true;
  const lobbyTimer = h.timers.find(timer => timer.delay === 600_000);
  assert.ok(lobbyTimer);
  await lobbyTimer.callback();
  h.failRead = false;
  h.failClose = false;
  assert.equal(session.status, "playing");
  assert.equal(session.participants.length, 2, "stored vote enrolls second player");

  let turns = 0;
  while (host.getTruthDareSession(groupJid)) {
    const player = session.turnOrder[session.currentIndex];
    assert.ok(player);
    const other = player.jid === starterJid ? playerJid : starterJid;
    assert.equal(await host.handleTruthDareAction({ sock, groupJid, senderJid: other, body: "truth" }), false);
    const choice = player.jid === starterJid ? "truth" : "dare";
    assert.equal(await host.handleTruthDareAction({ sock, groupJid, senderJid: player.jid, body: choice }), true);
    assert.equal(await host.handleTruthDareAction({ sock, groupJid, senderJid: player.jid, body: choice === "truth" ? "My answer" : "done" }), true);
    assert.ok(++turns <= 20);
  }
  assert.equal(turns, 20);
  assert.equal(h.results.find(row => row.memberJid === starterJid).points, 153);
  assert.equal(h.results.find(row => row.memberJid === playerJid).points, 203);
  assert.match(h.sent.at(-1).text, /Truth or Dare Complete/);
  assert.match(h.sent.at(-1).text, /Winner/);
  assert.equal(h.snapshots.has(groupJid), false);

  // Finalization keeps an idempotent checkpoint when permanent stats fail.
  const finalGroup = "td-final-retry@g.us";
  await host.startTruthDareSession({ sock, groupJid: finalGroup, starterJid, groupMetadata: metadata,
    rounds: 1, sendMessageWTyping: sock.sendMessage });
  await host.joinTruthDareLobby({ sock, groupJid: finalGroup, senderJid: playerJid });
  await host.closeTruthDareLobby({ sock, groupJid: finalGroup, senderJid: starterJid });
  const finalSession = host.getTruthDareSession(finalGroup);
  for (let i = 0; i < 2; i++) {
    const player = finalSession.turnOrder[finalSession.currentIndex];
    await host.handleTruthDareAction({ sock, groupJid: finalGroup, senderJid: player.jid, body: "truth" });
    if (i === 1) h.failStats = true;
    await host.handleTruthDareAction({ sock, groupJid: finalGroup, senderJid: player.jid, body: "My answer" });
  }
  assert.equal(host.getTruthDareSession(finalGroup).status, "finishing");
  assert.equal(h.snapshots.get(finalGroup).status, "finishing", "failed stats retain final totals");
  assert.equal(h.timers.at(-1).delay, 15000);
  h.failStats = false;
  const finalizedHost = await import(`${hostUrl}#finalization-restart`);
  await finalizedHost.restoreActiveTruthDareSessions({ sock });
  await h.timers.at(-1).callback();
  assert.equal(finalizedHost.getTruthDareSession(finalGroup), null);
  assert.equal(h.snapshots.has(finalGroup), false);
  assert.equal(h.results.filter(row => row.groupJid === finalGroup).length, 2);
  assert.match(h.sent.at(-1).text, /Truth or Dare Complete/);

  // A welcome-message failure must not strand the poll; reconnect must rearm
  // the saved lobby without waiting for a player to issue $td resume.
  const restartGroup = "td-restart@g.us";
  await assert.rejects(host.startTruthDareSession({ sock, groupJid: restartGroup, starterJid, groupMetadata: metadata,
    lobbyMs: 600_000, sendMessageWTyping: async () => { throw new Error("welcome failed"); } }), /welcome failed/);
  assert.ok(host.getTruthDareSession(restartGroup).timer);
  assert.ok(h.snapshots.get(restartGroup).phaseExpiresAt > Date.now());
  const recoveredHost = await import(`${hostUrl}#new-process`);
  await recoveredHost.restoreActiveTruthDareSessions({ sock });
  assert.equal(recoveredHost.getTruthDareSession(restartGroup).status, "lobby");
  const recoveryTimer = h.timers.at(-1);
  assert.ok(recoveryTimer.delay > 590_000 && recoveryTimer.delay <= 600_000);
  await pollManager.handleInteractivePollUpdate(sock, { key: { remoteJid: restartGroup, id: "poll-flow" }, update: { pollUpdates: [{
    pollUpdateMessageKey: { participant: playerJid },
    vote: { selectedOptions: [createHash("sha256").update("✅ Join game").digest()] },
  }] } });
  await recoveryTimer.callback();
  assert.equal(recoveredHost.getTruthDareSession(restartGroup).status, "playing");
  assert.equal(recoveredHost.getTruthDareSession(restartGroup).participants.length, 2);
});

test("poll secret cache lasts beyond two minutes, isolates chats, and expires", (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  // Imported module is shared with the end-to-end test above.
  return import("../utils/pollMessageStore.js").then(({ rememberPollMessage }) => {
    const key = { remoteJid: "long-lobby@g.us", id: "long-poll" };
    const message = { messageContextInfo: { messageSecret: new Uint8Array([1, 2, 3]) } };
    rememberPollMessage({ key, message }, 660_000);
    now += 180_000;
    assert.equal(readCachedPollMessage(key), message);
    assert.equal(readCachedPollMessage({ ...key, remoteJid: "other@g.us" }), undefined);
    now += 480_000;
    assert.equal(readCachedPollMessage(key), undefined);
  });
});
