import { recordGameResult } from "../db/gameData.js";
import { saveAutoGame, readAutoGame, listAutoGames, deleteAutoGame } from "../db/autoGameData.js";
import { createGameRound, isCorrectGameAnswer, gameCategories } from "./gameEngine.js";
import { finishInteractivePoll, registerInteractivePoll, recordInteractivePollChoice } from "./pollManager.js";
import { onPollVote } from "./pollVoteEvents.js";
import { participantJids, normalizeUserJid, isSameGroupUser } from "./groupParticipants.js";
import { alphaPanel, safeDisplayName } from "./alphaStyle.js";
import { parseHostedOptions } from "./hostedGameOptions.js";
import messageQueue from "../queue/messageQueue.js";
import { getSock } from "../core/socketRef.js";

export const AUTO_GAMES = ["trivia", "mathgame", "scramble", "emojiguess", "riddle", "fasttype", "oddoneout", "flagguess", "truefalse", "numberguess"];
const sessions = new Map();
const locks = new Map();
const JOIN = "✅ Join game";
const SKIP = "⏭️ Sit this one out";
const TURN_MS = 60_000;
const lock = (jid, work) => {
  const next = (locks.get(jid) || Promise.resolve()).catch(() => {}).then(work);
  locks.set(jid, next);
  next.finally(() => { if (locks.get(jid) === next) locks.delete(jid); }).catch(() => {});
  return next;
};
const send = (sock, jid, content) => messageQueue.enqueue(jid, () => (getSock() || sock).sendMessage(jid, content), 1);
const same = (session, jid, player) => isSameGroupUser(session.metadata, jid, player.aliases);
const find = (session, jid) => session.players.find(player => same(session, jid, player));
const playerFor = (session, jid, name = "") => {
  const normalized = normalizeUserJid(jid);
  const row = session.metadata?.participants?.find(entry => participantJids(entry).includes(normalized));
  const aliases = [...new Set([normalized, ...(row ? participantJids(row) : [])])];
  const canonical = aliases.find(id => id.endsWith("@s.whatsapp.net")) || normalized;
  return { jid: canonical, aliases, name: safeDisplayName(name || row?.notify || row?.name, canonical), points: 0, correct: 0, missed: 0 };
};
const join = (session, jid, name = "") => {
  const existing = find(session, jid);
  if (existing) return existing;
  if (session.players.length >= 20) return null;
  const player = playerFor(session, jid, name);
  session.players.push(player);
  return player;
};
const shuffle = (rows) => {
  const result = [...rows];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const clear = (session) => { if (session.timer) clearTimeout(session.timer); session.timer = null; };
const snapshot = ({ timer, metadata, saveTail, ...session }) => structuredClone(session);
const persist = (session) => {
  const row = snapshot(session);
  const next = (session.saveTail || Promise.resolve()).catch(() => {}).then(() => saveAutoGame(session.groupJid, row));
  session.saveTail = next;
  return next;
};
const arm = (sock, session, delay, work) => {
  clear(session);
  session.expiresAt = Date.now() + Math.max(250, delay);
  const token = (session.timerToken || 0) + 1;
  session.timerToken = token;
  session.timer = setTimeout(() => lock(session.groupJid, async () => {
    if (sessions.get(session.groupJid) !== session || session.timerToken !== token) return;
    try { await work(); }
    catch (error) {
      console.warn("[AUTO_GAME] timer failed:", error.message);
      if (sessions.get(session.groupJid) === session) arm(sock, session, 15_000, () => advance(sock, session));
    }
  }), Math.max(250, delay));
  session.timer.unref?.();
};
const current = (session) => session.players.find(player => player.jid === session.order[session.index]);
const board = (session) => [...session.players].sort((a, b) => b.points - a.points).map((player, index) =>
  `${index + 1}. *${player.name}* — ${player.points} pts · ${player.correct} correct · ${player.missed} missed`);
const allowed = (session, jid, isAdmin, isOwner) => isAdmin || isOwner ||
  isSameGroupUser(session.metadata, jid, [session.startedBy]);

export const getAutoGameSession = (jid) => sessions.get(jid) || null;
export const autoGameStatus = (jid) => {
  const session = sessions.get(jid);
  if (!session) return "🎮 No hosted game is active. Use `$game start trivia rounds=3 lobby=2m`.";
  return alphaPanel({ icon: "🎮", title: "Automatic Game Status", lines: [
    `Game: *${session.game}* · Phase: *${session.phase}*`,
    `Players: *${session.players.length}/20* · Round: *${session.round}/${session.rounds}*`,
    ...(session.status === "lobby" ? [
      `Lobby closes in: *${Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000))} seconds*`,
      ...session.players.map(player => player.name),
    ] : [`Player: *${current(session)?.name || "transitioning"}*`, `Question: *${session.question?.prompt || "—"}*`]),
  ], footer: "Use `$game join`, `$game close`, `$game liveboard`, `$game resume` or `$game stop`." });
};
export const autoGameScore = (jid) => sessions.has(jid) ? alphaPanel({ icon: "🏆", title: "Live Game Scores", lines: board(sessions.get(jid)) }) : autoGameStatus(jid);

async function finish(sock, session, stopped = false) {
  clear(session);
  session.phase = "finishing";
  session.stopped = stopped || session.stopped;
  await persist(session);
  const highest = Math.max(0, ...session.players.map(player => player.points));
  const winners = highest > 0 ? session.players.filter(player => player.points === highest) : [];
  await send(sock, session.groupJid, { text: alphaPanel({ icon: "🏁", title: session.stopped ? "Hosted Game Stopped" : "Hosted Game Complete", lines: [
    winners.length ? `Winner${winners.length > 1 ? "s" : ""}: 🏆 ${winners.map(player => player.name).join(", ")} — *${highest} pts*` : "No winner — nobody earned points.",
    `Game: *${session.game}* · Rounds: *${Math.min(session.round, session.rounds)}/${session.rounds}*`, ...board(session),
  ], footer: "Scores are saved in the Alpha game leaderboard. Use `$game board`." }), mentions: winners.map(player => player.jid) });
  await deleteAutoGame(session.groupJid);
  sessions.delete(session.groupJid);
}

async function drainResult(session) {
  if (!session.pendingResult) return;
  await recordGameResult(session.pendingResult);
  session.pendingResult = null;
  await persist(session);
}

async function settle(sock, session, correct, reason) {
  if (session.phase !== "answer") return;
  try {
  clear(session);
  const player = current(session);
  const question = session.question;
  const points = correct ? question.points : 0;
  player.points += points;
  if (correct) player.correct++; else player.missed++;
  session.pendingResult = { groupJid: session.groupJid, memberJid: player.jid, name: player.name, game: session.game,
    points, won: correct, correct, resultId: `${session.id}:${session.round}:${session.index}:${player.jid}` };
  session.index++;
  session.phase = "transition";
  await persist(session);
  await drainResult(session);
  await send(sock, session.groupJid, { text: `${correct ? "✅ Correct" : reason}! *${player.name}* earns *${points} pts*.\nAnswer: *${question.answers[0]}*`, mentions: [player.jid] });
  await advance(sock, session);
  } catch (error) {
    if (sessions.get(session.groupJid) === session) arm(sock, session, 15_000, () => advance(sock, session));
    throw error;
  }
}

async function advance(sock, session) {
  if (sessions.get(session.groupJid) !== session) return;
  if (session.status === "lobby") return closeLobby(sock, session);
  await drainResult(session);
  if (session.phase === "finishing") return finish(sock, session, session.stopped);
  if (session.phase === "answer") return settle(sock, session, false, "⌛ Time up");
  if (session.phase === "delivery") return deliverQuestion(sock, session);
  if (session.index >= session.order.length) {
    await send(sock, session.groupJid, { text: alphaPanel({ icon: "🏆", title: `Round ${session.round} Complete`, lines: board(session) }) });
    session.round++;
    if (session.round > session.rounds) return finish(sock, session);
    session.order = shuffle(session.players.map(player => player.jid));
    session.index = 0;
  }
  session.question = createGameRound(session.game, session.option);
  return deliverQuestion(sock, session);
}

async function deliverQuestion(sock, session) {
  const player = current(session);
  session.phase = "delivery";
  await persist(session);
  await send(sock, session.groupJid, { text: alphaPanel({ icon: "🎯", title: `${session.question.title} · Round ${session.round}/${session.rounds}`, lines: [
    `Player: *@${player.jid.split("@")[0]}* · Turn ${session.index + 1}/${session.order.length}`,
    `Question: *${session.question.prompt}*`, `Worth: *${session.question.points} pts*`,
    "Answer with *#your answer*, `$answer your answer` or `$game answer your answer`.",
  ], footer: "60 seconds. Wrong answers, skips and timeouts earn 0; Alpha advances automatically." }), mentions: [player.jid] });
  session.phase = "answer";
  arm(sock, session, TURN_MS, () => settle(sock, session, false, "⌛ Time up"));
  await persist(session);
}

async function closeLobby(sock, session) {
  if (session.status !== "lobby") return;
  clear(session);
  if (session.pollId) {
    const poll = await finishInteractivePoll(session.pollId, { result: "auto-game-started" });
    if (!poll) throw new Error("Lobby vote snapshot is unavailable");
    for (const vote of [...(poll.votes || [])].sort((a, b) => new Date(a.votedAt || 0) - new Date(b.votedAt || 0))) {
      if (vote.option === JOIN) join(session, vote.voterJid);
      else if (vote.option === SKIP || !vote.option) session.players = session.players.filter(player => !same(session, vote.voterJid, player));
    }
  }
  if (session.players.length < 2) {
    await deleteAutoGame(session.groupJid);
    sessions.delete(session.groupJid);
    return send(sock, session.groupJid, { text: `🎮 Lobby closed with ${session.players.length} counted player. At least 2 are required. Use *$game join* as a fallback when starting a fresh lobby.` });
  }
  session.status = "playing";
  session.phase = "transition";
  session.order = shuffle(session.players.map(player => player.jid));
  await persist(session);
  await send(sock, session.groupJid, { text: `🎮 ${session.players.length} players enrolled. Starting *${session.game}* for *${session.rounds} rounds*. Alpha hosts every turn; the starter/admin plays too.` });
  await advance(sock, session);
}

export const restoreAutoGame = async ({ sock, groupJid }) => {
  if (sessions.has(groupJid)) return sessions.get(groupJid);
  const row = await readAutoGame(groupJid);
  if (!row || !["lobby", "playing"].includes(row.status)) return null;
  const { _id, updatedAt, ...saved } = row;
  const session = { ...saved, metadata: await sock.groupMetadata(groupJid), timer: null };
  sessions.set(groupJid, session);
  const delay = ["lobby", "answer"].includes(session.phase) ? Math.max(250, session.expiresAt - Date.now()) : 250;
  arm(sock, session, delay, () => advance(sock, session));
  return session;
};
export const restoreActiveAutoGames = async ({ sock }) => {
  for (const row of await listAutoGames()) await lock(row.groupJid, () => restoreAutoGame({ sock, groupJid: row.groupJid })).catch(error => console.warn("[AUTO_GAME] recovery failed:", error.message));
};

onPollVote("auto-game-lobby", (poll, vote) => lock(poll.groupJid, async () => {
  const session = sessions.get(poll.groupJid);
  if (!session || session.status !== "lobby" || session.pollId !== poll._id) return;
  if (vote.option === JOIN) join(session, vote.voterJid);
  else session.players = session.players.filter(player => !same(session, vote.voterJid, player));
  await persist(session);
}));

export const startAutoGame = ({ sock, groupJid, senderJid, name, args = [], metadata }) => lock(groupJid, async () => {
  if (await restoreAutoGame({ sock, groupJid })) return "🎮 A hosted game is already active. Use `$game status` or `$game stop`.";
  const { rounds, lobbyMs, rest } = parseHostedOptions(args, { rounds: 2, lobbyMs: 60_000 });
  const game = rest[0] || "trivia";
  if (!AUTO_GAMES.includes(game)) return `🎮 Choose a hosted game: ${AUTO_GAMES.join(", ")}.`;
  const option = game === "trivia" && gameCategories.includes(rest[1]) ? rest[1] : "general";
  const session = { id: `${Date.now()}:${Math.random().toString(36).slice(2)}`, groupJid, metadata: metadata || await sock.groupMetadata(groupJid),
    status: "lobby", phase: "lobby", game, option, rounds, lobbyMs, round: 1, index: 0, players: [], order: [], startedBy: senderJid,
    pollId: "", question: null, pendingResult: null, expiresAt: 0, timerToken: 0 };
  join(session, senderJid, name);
  sessions.set(groupJid, session);
  arm(sock, session, lobbyMs, () => closeLobby(sock, session));
  await persist(session);
  try {
    const poll = await sock.sendMessage(groupJid, { poll: { name: `🎮 ${game} · ${rounds} rounds\nStarter auto-joined. Lobby closes in ${lobbyMs / 1000} seconds.`, values: [JOIN, SKIP], selectableCount: 1 } });
    session.pollId = poll.key.id;
    await registerInteractivePoll({ sentMessage: poll, groupJid, type: "auto-game-lobby", ownerJid: senderJid, options: [JOIN, SKIP], ttlMs: lobbyMs + 60_000 });
  } catch (error) { session.pollId = ""; console.warn("[AUTO_GAME] poll unavailable:", error.message); }
  await persist(session);
  return `🎮 *${game}* lobby opened for *${lobbyMs / 1000} seconds* · *${rounds} rounds*.\nThe starter is enrolled. ${session.pollId ? "Vote Join game or use" : "Poll unavailable; use"} *$game join*.\nCheck counted players with *$game status*. Alpha starts when the timer ends; starter/admin can use *$game close* to start early.`;
});

export const controlAutoGame = ({ sock, groupJid, senderJid, name, action, isAdmin = false, isOwner = false }) => lock(groupJid, async () => {
  const session = await restoreAutoGame({ sock, groupJid });
  if (!session) return autoGameStatus(groupJid);
  if (action === "status" || action === "resume") return autoGameStatus(groupJid);
  if (action === "liveboard") return autoGameScore(groupJid);
  if (action === "join" || action === "leave") {
    if (session.status !== "lobby") return "🎮 Joining/leaving is available only during the lobby.";
    if (action === "join") {
      const player = join(session, senderJid, name);
      if (!player) return "🎮 Lobby full: 20 players.";
    } else session.players = session.players.filter(player => !same(session, senderJid, player));
    if (session.pollId) await recordInteractivePollChoice(session.pollId, normalizeUserJid(senderJid), action === "join" ? JOIN : SKIP);
    await persist(session);
    return `🎮 ${action === "join" ? "Joined" : "Left"}. Counted players: *${session.players.length}/20*.`;
  }
  if (!allowed(session, senderJid, isAdmin, isOwner)) return "❌ Only the starter, an admin or the bot owner can control the game.";
  if (action === "close") {
    if (session.status !== "lobby") return "🎮 The lobby has already closed.";
    try { await closeLobby(sock, session); }
    catch (error) { arm(sock, session, 15_000, () => advance(sock, session)); throw error; }
    return "";
  }
  if (action === "next") { if (session.status !== "playing") return "🎮 Wait until the game starts before skipping a turn."; await settle(sock, session, false, "⏭️ Host skipped turn"); return ""; }
  if (action === "stop") {
    if (session.status === "playing") {
      try { await drainResult(session); await finish(sock, session, true); }
      catch (error) { arm(sock, session, 15_000, () => advance(sock, session)); throw error; }
    }
    else { clear(session); if (session.pollId) await finishInteractivePoll(session.pollId); await deleteAutoGame(groupJid); sessions.delete(groupJid); }
    return "🛑 Hosted game stopped. Earned scores were saved.";
  }
  return autoGameStatus(groupJid);
});

export const answerAutoGame = ({ sock, groupJid, senderJid, answer }) => lock(groupJid, async () => {
  const session = await restoreAutoGame({ sock, groupJid });
  if (!session || session.phase !== "answer" || !same(session, senderJid, current(session))) return false;
  if (Date.now() >= session.expiresAt) { await settle(sock, session, false, "⌛ Time up"); return true; }
  const skipped = /^(skip|pass)$/i.test(String(answer).trim());
  await settle(sock, session, !skipped && isCorrectGameAnswer(answer, session.question.answers), skipped ? "⏭️ Skipped" : "❌ Incorrect");
  return true;
});
