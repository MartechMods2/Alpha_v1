import { recordGameResult } from "../db/gameData.js";
import {
  deleteTruthDareSessionSnapshot,
  getTruthDareLeaderboard,
  getTruthDareProfile,
  getTruthDareSessionSnapshot,
  recordTruthDareSessionPlayer,
  saveTruthDareSessionSnapshot,
} from "../db/truthDareData.js";
import messageQueue from "../queue/messageQueue.js";
import {
  finishInteractivePoll,
  readInteractivePoll,
  registerInteractivePoll,
} from "./pollManager.js";
import {
  isSameGroupUser,
  normalizeUserJid,
  participantJids,
} from "./groupParticipants.js";
import { alphaPanel, safeDisplayName } from "./alphaStyle.js";
import {
  buildTruthDareDeck,
  normalizeTruthDareTheme,
  truthDareReaction,
  truthDareThemes,
} from "./truthDarePrompts.js";

const sessions = new Map();

const LOBBY_MS = 30_000;
const CHOICE_MS = 45_000;
const RESPONSE_MS = 90_000;
const SESSION_TTL_MS = 50 * 60_000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 20;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 4;
const TRUTH_POINTS = 10;
const DARE_POINTS = 15;
const PERFECT_BONUS = 5;
const JOIN_OPTION = "✅ Join game";
const SKIP_OPTION = "⏭️ Sit this one out";

const clean = (value, max = 300) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const sendQueued = (sock, jid, content, options = {}) =>
  messageQueue.enqueue(jid, () => sock.sendMessage(jid, content, options), 1);

const snapshotOf = (session) => ({
  id: session.id,
  status: session.status,
  phase: session.phase,
  startedBy: session.startedBy,
  participants: session.participants.map((player) => ({
    jid: player.jid,
    aliases: [...(player.aliases || [])],
    name: player.name,
    score: player.score || 0,
    truths: player.truths || 0,
    dares: player.dares || 0,
    skips: player.skips || 0,
    timeouts: player.timeouts || 0,
    completed: player.completed || 0,
    streak: player.streak || 0,
    bestStreak: player.bestStreak || 0,
    perfectBonus: player.perfectBonus || 0,
  })),
  turnOrderJids: session.turnOrder.map((player) => player.jid),
  currentRound: session.currentRound,
  currentIndex: session.currentIndex,
  rounds: session.rounds,
  theme: session.theme,
  truthDeck: [...session.truthDeck],
  dareDeck: [...session.dareDeck],
  pollId: session.pollId || "",
  timerToken: session.timerToken || 0,
  startedAt: session.startedAt,
  phaseExpiresAt: session.phaseExpiresAt || 0,
  choice: session.choice || "",
  currentPrompt: session.currentPrompt || "",
  promptMessageId: session.promptMessageId || "",
  turnMessageId: session.turnMessageId || "",
});

const persistSession = async (session) => {
  if (!session || session.status === "finished") return;
  try {
    await saveTruthDareSessionSnapshot(session.groupJid, snapshotOf(session));
  } catch (error) {
    console.warn("[TRUTH_DARE] session snapshot failed:", error.message);
  }
};

const clearTimer = (session) => {
  if (session?.timer) clearTimeout(session.timer);
  if (session) session.timer = null;
};

const schedule = (session, ms, callback) => {
  clearTimer(session);
  const delay = Math.max(250, Number(ms) || 250);
  const token = ++session.timerToken;
  session.phaseExpiresAt = Date.now() + delay;
  const timer = setTimeout(async () => {
    if (!sessions.has(session.groupJid) || sessions.get(session.groupJid) !== session) return;
    if (token !== session.timerToken) return;
    try {
      await callback();
    } catch (error) {
      console.error("[TRUTH_DARE] timer failed:", error.message);
    }
  }, delay);
  timer.unref?.();
  session.timer = timer;
  void persistSession(session);
};

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const participantFromJid = (metadata, jid, nameHint = "") => {
  const normalized = normalizeUserJid(jid);
  const participant = (metadata?.participants || []).find((entry) =>
    participantJids(entry).includes(normalized));
  const aliases = participant ? participantJids(participant) : [normalized].filter(Boolean);
  const canonical =
    aliases.find((entry) => entry.endsWith("@s.whatsapp.net")) ||
    aliases[0] ||
    normalized ||
    jid;
  return {
    jid: canonical,
    aliases: [...new Set([canonical, ...aliases].filter(Boolean))],
    name: safeDisplayName(
      nameHint ||
      participant?.notify ||
      participant?.name ||
      participant?.verifiedName ||
      "",
      canonical,
    ),
    score: 0,
    truths: 0,
    dares: 0,
    skips: 0,
    timeouts: 0,
    completed: 0,
    streak: 0,
    bestStreak: 0,
    perfectBonus: 0,
  };
};

const samePlayer = (session, senderJid, player) => {
  if (!player || !senderJid) return false;
  const normalized = normalizeUserJid(senderJid);
  if (player.aliases.includes(normalized)) return true;
  return isSameGroupUser(session.groupMetadata, senderJid, player.aliases);
};

const findParticipant = (session, senderJid) =>
  session.participants.find((player) => samePlayer(session, senderJid, player));

const addParticipant = (session, jid, nameHint = "") => {
  const existing = findParticipant(session, jid);
  if (existing) {
    if (nameHint) existing.name = safeDisplayName(nameHint, existing.jid);
    return existing;
  }
  if (session.participants.length >= MAX_PLAYERS) return null;
  const player = participantFromJid(session.groupMetadata, jid, nameHint);
  session.participants.push(player);
  return player;
};

const removeParticipant = (session, jid) => {
  const index = session.participants.findIndex((player) => samePlayer(session, jid, player));
  if (index < 0) return false;
  session.participants.splice(index, 1);
  return true;
};

const currentPlayer = (session) => session.turnOrder[session.currentIndex] || null;

const scoreRows = (session) =>
  [...session.participants]
    .sort((a, b) => b.score - a.score || b.completed - a.completed || a.name.localeCompare(b.name))
    .map((player, index) =>
      `${index + 1}. *${player.name}* — ${player.score} pts · 🎯 ${player.truths} · 🔥 ${player.dares} · ⏭️ ${player.skips} · ⌛ ${player.timeouts}`);

const liveScorePanel = (session, title = "Truth or Dare Scoreboard") =>
  alphaPanel({
    icon: "🏆",
    title,
    lines: scoreRows(session),
    footer: `Round ${session.currentRound}/${session.rounds} · Truth ${TRUTH_POINTS} pts · Dare ${DARE_POINTS} pts · streak bonus up to +6`,
  });

const promptFromDeck = (session, type) => {
  const key = type === "dare" ? "dareDeck" : "truthDeck";
  if (!session[key].length) session[key] = buildTruthDareDeck({ theme: session.theme, type });
  return session[key].shift();
};

const turnPoints = (player, type) => {
  player.streak += 1;
  player.bestStreak = Math.max(player.bestStreak, player.streak);
  const base = type === "dare" ? DARE_POINTS : TRUTH_POINTS;
  const streakBonus = Math.min(6, Math.max(0, player.streak - 1) * 2);
  return { base, streakBonus, total: base + streakBonus };
};

const formatPlayerMention = (player) => `@${String(player.jid || "").split("@")[0]}`;

const sessionIsExpired = (session) => Date.now() - session.startedAt > SESSION_TTL_MS;

const cleanupExpiredSession = async (sock, session) => {
  if (!sessionIsExpired(session)) return false;
  clearTimer(session);
  sessions.delete(session.groupJid);
  if (session.pollId) await finishInteractivePoll(session.pollId, { result: "truth-dare-expired" }).catch(() => {});
  await sendQueued(sock, session.groupJid, {
    text: "⌛ *Truth or Dare session expired after 50 minutes.* Start a fresh one with `$td start`.",
  }).catch(() => {});
  return true;
};

const finishSession = async (sock, session, { stopped = false } = {}) => {
  clearTimer(session);
  session.status = "finished";

  for (const player of session.participants) {
    const perfect = player.completed === session.rounds && player.skips === 0 && player.timeouts === 0;
    if (perfect) {
      player.perfectBonus = PERFECT_BONUS;
      player.score += PERFECT_BONUS;
    }
  }

  const highest = Math.max(0, ...session.participants.map((player) => player.score));
  const winners = highest > 0
    ? session.participants.filter((player) => player.score === highest)
    : [];

  await Promise.all(session.participants.map(async (player) => {
    const won = winners.includes(player);
    await Promise.all([
      recordTruthDareSessionPlayer({
        groupJid: session.groupJid,
        memberJid: player.jid,
        name: player.name,
        points: player.score,
        truths: player.truths,
        dares: player.dares,
        skips: player.skips,
        timeouts: player.timeouts,
        won,
        perfect: player.perfectBonus > 0,
      }),
      recordGameResult({
        groupJid: session.groupJid,
        memberJid: player.jid,
        name: player.name,
        game: "truthdare",
        points: player.score,
        won,
        correct: player.completed > 0,
      }),
    ]);
  })).catch((error) => console.warn("[TRUTH_DARE] stat persistence:", error.message));

  sessions.delete(session.groupJid);

  const winnerLine = winners.length
    ? `Winner${winners.length > 1 ? "s" : ""}: 🏆 ${winners.map((player) => player.name).join(", ")} — *${highest} pts*`
    : "No winner this time — everybody escaped the points. 😭";
  const perfectPlayers = session.participants.filter((player) => player.perfectBonus > 0);

  await sendQueued(sock, session.groupJid, {
    text: alphaPanel({
      icon: stopped ? "🛑" : "🏁",
      title: stopped ? "Truth or Dare Ended" : "Truth or Dare Complete",
      lines: [
        winnerLine,
        "",
        ...scoreRows(session),
        "",
        `Rounds: *${Math.min(session.currentRound, session.rounds)}/${session.rounds}*`,
        `Players: *${session.participants.length}*`,
        `Truths completed: *${session.participants.reduce((n, player) => n + player.truths, 0)}*`,
        `Dares completed: *${session.participants.reduce((n, player) => n + player.dares, 0)}*`,
        `Skips: *${session.participants.reduce((n, player) => n + player.skips, 0)}* · Timeouts: *${session.participants.reduce((n, player) => n + player.timeouts, 0)}*`,
        ...(perfectPlayers.length ? [`✨ Perfect-run bonus (+${PERFECT_BONUS}): ${perfectPlayers.map((player) => player.name).join(", ")}`] : []),
      ],
      footer: stopped
        ? "Scores earned before the stop were saved."
        : "Alpha hosted every turn automatically. Use `$td board` for the persistent leaderboard.",
    }),
  });
};

const startNextTurn = async (sock, session) => {
  if (!sessions.has(session.groupJid)) return;
  if (await cleanupExpiredSession(sock, session)) return;

  if (session.currentIndex >= session.turnOrder.length) {
    await sendQueued(sock, session.groupJid, { text: liveScorePanel(session, `Round ${session.currentRound} Complete`) });
    session.currentRound += 1;
    if (session.currentRound > session.rounds) return finishSession(sock, session);
    session.turnOrder = shuffle(session.participants);
    session.currentIndex = 0;
    await sendQueued(sock, session.groupJid, {
      text: alphaPanel({
        icon: "⚡",
        title: `Round ${session.currentRound}/${session.rounds}`,
        lines: [
          "Alpha reshuffled the active players.",
          truthDareReaction("next"),
        ],
        footer: "Truth and Dare both remain optional. Skip is always allowed.",
      }),
    });
  }

  const player = currentPlayer(session);
  if (!player) return finishSession(sock, session);

  session.phase = "choice";
  session.choice = "";
  session.currentPrompt = "";
  session.promptMessageId = "";
  const turnNumber = ((session.currentRound - 1) * session.participants.length) + session.currentIndex + 1;
  const totalTurns = session.rounds * session.participants.length;

  const sent = await sendQueued(sock, session.groupJid, {
    text: alphaPanel({
      icon: "🎭",
      title: `Turn ${turnNumber}/${totalTurns} · Round ${session.currentRound}/${session.rounds}`,
      lines: [
        `Player: *${formatPlayerMention(player)}*`,
        `Current score: *${player.score} pts*`,
        "",
        "Choose: *truth* · *dare* · *skip*",
        "You can type the word normally — no command prefix needed.",
      ],
      footer: `45 seconds to choose · Truth ${TRUTH_POINTS} pts · Dare ${DARE_POINTS} pts`,
    }),
    mentions: [player.jid],
  });
  session.turnMessageId = sent?.key?.id || "";

  const expectedRound = session.currentRound;
  const expectedIndex = session.currentIndex;
  schedule(session, CHOICE_MS, async () => {
    if (session.phase !== "choice" || session.currentRound !== expectedRound || session.currentIndex !== expectedIndex) return;
    player.timeouts += 1;
    player.streak = 0;
    session.phase = "transition";
    await sendQueued(sock, session.groupJid, {
      text: `⌛ ${formatPlayerMention(player)} did not choose in time. *0 points.*\n${truthDareReaction("timeout")}`,
      mentions: [player.jid],
    });
    session.currentIndex += 1;
    await startNextTurn(sock, session);
  });
};

const completeChoice = async (sock, session, player, choice) => {
  clearTimer(session);
  session.choice = choice;

  if (choice === "skip") {
    player.skips += 1;
    player.streak = 0;
    session.phase = "transition";
    await sendQueued(sock, session.groupJid, {
      text: `${truthDareReaction("skip")}\n${formatPlayerMention(player)} gets *0 points* this turn.`,
      mentions: [player.jid],
    });
    session.currentIndex += 1;
    return startNextTurn(sock, session);
  }

  const prompt = promptFromDeck(session, choice);
  session.currentPrompt = prompt;
  session.phase = "response";
  const points = choice === "dare" ? DARE_POINTS : TRUTH_POINTS;
  const instruction = choice === "truth"
    ? "Answer normally in the chat. Alpha does not store the text of your answer."
    : "Complete it, then type *done*. You can type *skip* at any time.";

  const sent = await sendQueued(sock, session.groupJid, {
    text: alphaPanel({
      icon: choice === "dare" ? "🔥" : "🎯",
      title: `${choice === "dare" ? "Dare" : "Truth"} for ${player.name}`,
      lines: [
        truthDareReaction(choice),
        "",
        `*${prompt}*`,
        "",
        instruction,
        `Worth: *${points} pts* + streak bonus`,
      ],
      footer: "90 seconds · voluntary · safe skips are always accepted",
    }),
    mentions: [player.jid],
  });
  session.promptMessageId = sent?.key?.id || "";

  const expectedRound = session.currentRound;
  const expectedIndex = session.currentIndex;
  schedule(session, RESPONSE_MS, async () => {
    if (session.phase !== "response" || session.currentRound !== expectedRound || session.currentIndex !== expectedIndex) return;
    player.timeouts += 1;
    player.streak = 0;
    session.phase = "transition";
    await sendQueued(sock, session.groupJid, {
      text: `⌛ ${formatPlayerMention(player)} ran out of time. *0 points.*\n${truthDareReaction("timeout")}`,
      mentions: [player.jid],
    });
    session.currentIndex += 1;
    await startNextTurn(sock, session);
  });
};

const completeResponse = async (sock, session, player, type) => {
  clearTimer(session);
  session.phase = "transition";
  const earned = turnPoints(player, type);
  player.score += earned.total;
  player.completed += 1;
  if (type === "truth") player.truths += 1;
  else player.dares += 1;

  await sendQueued(sock, session.groupJid, {
    text: `${truthDareReaction("complete")}\n${formatPlayerMention(player)} earns *+${earned.total} pts*${earned.streakBonus ? ` (*+${earned.streakBonus} streak bonus*)` : ""}.\nTotal: *${player.score} pts*.`,
    mentions: [player.jid],
  });
  session.currentIndex += 1;
  await startNextTurn(sock, session);
};

const closeLobbyInternal = async (sock, session) => {
  if (!session || session.status !== "lobby") return false;
  clearTimer(session);

  const poll = session.pollId ? await readInteractivePoll(session.pollId).catch(() => null) : null;
  if (session.pollId) await finishInteractivePoll(session.pollId, { result: "truth-dare-lobby-closed" }).catch(() => {});

  const votes = poll?.votes || [];
  for (const vote of votes) {
    if (!vote?.voterJid) continue;
    if (vote.option === JOIN_OPTION) addParticipant(session, vote.voterJid);
    if (vote.option === SKIP_OPTION) removeParticipant(session, vote.voterJid);
  }

  if (session.participants.length < MIN_PLAYERS) {
    sessions.delete(session.groupJid);
    await sendQueued(sock, session.groupJid, {
      text: "🎭 Lobby closed, but fewer than 2 players joined. Truth or Dare was cancelled.",
    });
    return true;
  }

  session.status = "playing";
  session.turnOrder = shuffle(session.participants);
  session.currentRound = 1;
  session.currentIndex = 0;
  session.phase = "transition";

  await sendQueued(sock, session.groupJid, {
    text: alphaPanel({
      icon: "🔥",
      title: "Truth or Dare Lobby Closed",
      lines: [
        `Players: *${session.participants.length}*`,
        `Rounds: *${session.rounds}*`,
        `Theme: *${session.theme}*`,
        "",
        ...session.turnOrder.map((player, index) => `${index + 1}. ${player.name}`),
      ],
      footer: "Alpha is the host now. The starter/admin can play normally—no manual hosting is required.",
    }),
  });

  await startNextTurn(sock, session);
  return true;
};

export const startTruthDareSession = async ({
  sock,
  msg,
  groupJid,
  starterJid,
  starterName,
  groupMetadata,
  rounds = 2,
  theme = "classic",
  sendMessageWTyping,
}) => {
  const existing = sessions.get(groupJid);
  if (existing) {
    return sendMessageWTyping(groupJid, {
      text: existing.status === "lobby"
        ? "🎭 A Truth or Dare lobby is already open. Use `$td join` or `$td close`."
        : "🎭 Truth or Dare is already running. Use `$td status`, `$td score`, or `$td stop`.",
    }, { quoted: msg });
  }

  const safeRounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Number.parseInt(rounds, 10) || 2));
  const safeTheme = normalizeTruthDareTheme(theme);
  const metadata = groupMetadata || await sock.groupMetadata(groupJid);
  const starter = participantFromJid(metadata, starterJid, starterName);

  const session = {
    id: `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    groupJid,
    groupMetadata: metadata,
    status: "lobby",
    phase: "lobby",
    startedBy: starter.jid,
    participants: [starter],
    turnOrder: [],
    currentRound: 1,
    currentIndex: 0,
    rounds: safeRounds,
    theme: safeTheme,
    truthDeck: buildTruthDareDeck({ theme: safeTheme, type: "truth" }),
    dareDeck: buildTruthDareDeck({ theme: safeTheme, type: "dare" }),
    pollId: "",
    timer: null,
    timerToken: 0,
    startedAt: Date.now(),
  };
  sessions.set(groupJid, session);

  try {
    const pollMessage = await sock.sendMessage(groupJid, {
      poll: {
        name: `🎭 Alpha Truth or Dare · ${safeRounds} round${safeRounds === 1 ? "" : "s"} · ${safeTheme}\nVote to join. The game starter is already enrolled. Lobby closes in 30 seconds.`,
        values: [JOIN_OPTION, SKIP_OPTION],
        selectableCount: 1,
      },
    }, { quoted: msg });

    session.pollId = pollMessage?.key?.id || "";
    if (session.pollId) {
      await registerInteractivePoll({
        sentMessage: pollMessage,
        groupJid,
        type: "truth-dare-lobby",
        ownerJid: starter.jid,
        options: [JOIN_OPTION, SKIP_OPTION],
        payload: { sessionId: session.id, rounds: safeRounds, theme: safeTheme },
        ttlMs: LOBBY_MS + 60_000,
      });
    }
  } catch (pollError) {
    console.warn("[TRUTH_DARE] poll lobby unavailable, using command fallback:", pollError.message);
    session.pollId = "";
  }

  await sendMessageWTyping(groupJid, {
    text: alphaPanel({
      icon: "🎭",
      title: "Alpha Truth or Dare",
      lines: [
        `Starter: *${starter.name}* — automatically joined so the host can participate too.`,
        `Theme: *${safeTheme}* · Rounds: *${safeRounds}*`,
        `Up to *${MAX_PLAYERS} players*.`,
        "",
        session.pollId
          ? "Everyone else: vote *Join game* in the poll or type `$td join`."
          : "WhatsApp poll creation was unavailable, so everyone else should type `$td join`.",
        "Alpha will shuffle players, manage every turn, keep time, score the game and announce the winner automatically.",
        "",
        `🎯 Truth = *${TRUTH_POINTS} pts*`,
        `🔥 Dare = *${DARE_POINTS} pts*`,
        "⚡ Consecutive completed turns earn +2/+4/+6 streak bonuses.",
        `✨ Complete every round without a skip/timeout for +${PERFECT_BONUS} perfect-run bonus.`,
      ],
      footer: "Skip is always allowed. No negative points. Starter/admin can use `$td close` to close the lobby early.",
    }),
  }, { quoted: msg });

  schedule(session, LOBBY_MS, () => closeLobbyInternal(sock, session));
  return true;
};

export const joinTruthDareLobby = async ({ groupJid, senderJid, senderName = "" }) => {
  const session = sessions.get(groupJid);
  if (!session || session.status !== "lobby") return { ok: false, message: "🎭 No Truth or Dare lobby is open." };
  const player = addParticipant(session, senderJid, senderName);
  if (!player) return { ok: false, message: `🎭 Lobby is full at ${MAX_PLAYERS} players.` };
  return { ok: true, message: `✅ *${player.name}* joined Truth or Dare. Players: *${session.participants.length}/${MAX_PLAYERS}*.` };
};

export const leaveTruthDareLobby = ({ groupJid, senderJid }) => {
  const session = sessions.get(groupJid);
  if (!session || session.status !== "lobby") return { ok: false, message: "🎭 No Truth or Dare lobby is open." };
  const removed = removeParticipant(session, senderJid);
  return {
    ok: removed,
    message: removed ? "⏭️ You left the Truth or Dare lobby." : "You were not in the Truth or Dare lobby.",
  };
};

export const closeTruthDareLobby = async ({ sock, groupJid, senderJid, isGroupAdmin = false, isOwner = false }) => {
  const session = sessions.get(groupJid);
  if (!session || session.status !== "lobby") return { ok: false, message: "🎭 No Truth or Dare lobby is open." };
  if (!isGroupAdmin && !isOwner && !samePlayer(session, senderJid, { aliases: [session.startedBy] })) {
    return { ok: false, message: "❌ Only the game starter, a group admin or the bot owner can close the lobby early." };
  }
  await closeLobbyInternal(sock, session);
  return { ok: true, message: "" };
};

export const stopTruthDareSession = async ({ sock, groupJid, senderJid, isGroupAdmin = false, isOwner = false }) => {
  const session = sessions.get(groupJid);
  if (!session) return { ok: false, message: "🎭 No Truth or Dare game is active." };
  const starter = { aliases: [session.startedBy] };
  if (!isGroupAdmin && !isOwner && !samePlayer(session, senderJid, starter)) {
    return { ok: false, message: "❌ Only the game starter, a group admin or the bot owner can stop this game." };
  }
  if (session.status === "lobby") {
    clearTimer(session);
    if (session.pollId) await finishInteractivePoll(session.pollId, { result: "truth-dare-stopped" }).catch(() => {});
    sessions.delete(groupJid);
    return { ok: true, message: "🛑 Truth or Dare lobby closed." };
  }
  await finishSession(sock, session, { stopped: true });
  return { ok: true, message: "" };
};

export const forceNextTruthDareTurn = async ({ sock, groupJid, senderJid, isGroupAdmin = false, isOwner = false }) => {
  const session = sessions.get(groupJid);
  if (!session || session.status !== "playing") return { ok: false, message: "🎭 No Truth or Dare game is running." };
  if (!isGroupAdmin && !isOwner && !samePlayer(session, senderJid, { aliases: [session.startedBy] })) {
    return { ok: false, message: "❌ Only the game starter, a group admin or the bot owner can force the next turn." };
  }
  const player = currentPlayer(session);
  if (player) {
    player.skips += 1;
    player.streak = 0;
  }
  clearTimer(session);
  session.phase = "transition";
  session.currentIndex += 1;
  await sendQueued(sock, groupJid, {
    text: player ? `⏭️ Host moved past ${player.name}'s turn. *0 points* for this turn.` : "⏭️ Moving to the next turn.",
  });
  await startNextTurn(sock, session);
  return { ok: true, message: "" };
};

export const getTruthDareSession = (groupJid) => sessions.get(groupJid) || null;

export const truthDareStatusText = (groupJid) => {
  const session = sessions.get(groupJid);
  if (!session) return "🎭 No Truth or Dare game is active. Use `$td start`.";
  if (session.status === "lobby") {
    return alphaPanel({
      icon: "🎭",
      title: "Truth or Dare Lobby",
      lines: [
        `Players joined: *${session.participants.length}/${MAX_PLAYERS}*`,
        `Rounds: *${session.rounds}* · Theme: *${session.theme}*`,
        ...session.participants.map((player, index) => `${index + 1}. ${player.name}`),
      ],
      footer: "Vote Join or use `$td join`. Starter/admin can use `$td close`.",
    });
  }
  const player = currentPlayer(session);
  return alphaPanel({
    icon: "🎭",
    title: "Truth or Dare Status",
    lines: [
      `Round: *${session.currentRound}/${session.rounds}*`,
      `Turn: *${session.currentIndex + 1}/${session.turnOrder.length}*`,
      `Current player: *${player?.name || "transitioning"}*`,
      `Phase: *${session.phase}*`,
      `Theme: *${session.theme}*`,
    ],
    footer: "Use `$td score` for the live scoreboard.",
  });
};

export const truthDareScoreText = (groupJid) => {
  const session = sessions.get(groupJid);
  return session ? liveScorePanel(session) : "🎭 No live Truth or Dare scoreboard. Use `$td board` for saved results.";
};

export const truthDarePersistentBoardText = async (groupJid) => {
  const leaders = await getTruthDareLeaderboard(groupJid, 10);
  if (!leaders.length) return "🏆 No Truth or Dare scores have been saved in this group yet.";
  return alphaPanel({
    icon: "🏆",
    title: "Truth or Dare Leaderboard",
    lines: leaders.map((entry, index) =>
      `${index + 1}. *${safeDisplayName(entry.name, entry.memberJid)}* — ${entry.points || 0} pts · ${entry.wins || 0} wins · ${entry.sessions || 0} sessions`),
    footer: "Persistent totals from completed or manually stopped hosted sessions.",
  });
};

export const truthDareProfileText = async (groupJid, memberJid, name = "") => {
  const profile = await getTruthDareProfile(groupJid, memberJid);
  const display = safeDisplayName(profile?.name || name, memberJid);
  if (!profile) return `🎭 *${display}* has no saved Truth or Dare stats yet.`;
  return alphaPanel({
    icon: "🎭",
    title: `${display}'s Truth or Dare Card`,
    lines: [
      `Points: *${profile.points || 0}*`,
      `Sessions: *${profile.sessions || 0}* · Wins: *${profile.wins || 0}*`,
      `Truths: *${profile.truths || 0}* · Dares: *${profile.dares || 0}*`,
      `Skips: *${profile.skips || 0}* · Timeouts: *${profile.timeouts || 0}*`,
      `Perfect runs: *${profile.perfectRuns || 0}*`,
    ],
  });
};

export const handleTruthDareAction = async ({
  sock,
  groupJid,
  senderJid,
  body,
  fromCommand = false,
}) => {
  const session = sessions.get(groupJid);
  if (!session || session.status !== "playing") return false;
  if (sessionIsExpired(session)) {
    await cleanupExpiredSession(sock, session);
    return true;
  }

  const player = currentPlayer(session);
  if (!player || !samePlayer(session, senderJid, player)) return false;

  const raw = clean(body, 1200);
  const action = raw.toLowerCase().replace(/[.!?]+$/g, "").trim();
  if (!action) return false;

  if (session.phase === "choice") {
    if (["truth", "t"].includes(action)) {
      session.phase = "loading";
      await completeChoice(sock, session, player, "truth");
      return true;
    }
    if (["dare", "d"].includes(action)) {
      session.phase = "loading";
      await completeChoice(sock, session, player, "dare");
      return true;
    }
    if (["skip", "s", "pass"].includes(action)) {
      session.phase = "loading";
      await completeChoice(sock, session, player, "skip");
      return true;
    }
    return false;
  }

  if (session.phase !== "response") return false;

  if (["skip", "s", "pass"].includes(action)) {
    clearTimer(session);
    player.skips += 1;
    player.streak = 0;
    session.phase = "transition";
    await sendQueued(sock, groupJid, {
      text: `${truthDareReaction("skip")}\n${formatPlayerMention(player)} gets *0 points* this turn.`,
      mentions: [player.jid],
    });
    session.currentIndex += 1;
    await startNextTurn(sock, session);
    return true;
  }

  if (session.choice === "dare") {
    if (!["done", "complete", "completed", "finished", "finish"].includes(action)) return false;
    await completeResponse(sock, session, player, "dare");
    return true;
  }

  const prefix = String(process.env.PREFIX || "$");
  if (!fromCommand && (raw.startsWith(prefix) || raw.startsWith("/") || raw.startsWith("#"))) return false;
  if (["done", "complete", "completed", "finished", "finish"].includes(action)) return false;
  await completeResponse(sock, session, player, "truth");
  return true;
};

export const truthDareHelpText = (prefix = "$") => alphaPanel({
  icon: "🎭",
  title: "Alpha Hosted Truth or Dare",
  lines: [
    `*${prefix}td start* — 2 rounds, classic theme`,
    `*${prefix}td start 3 funny* — 3 rounds, funny theme`,
    `Themes: *${truthDareThemes.join(", ")}*`,
    `*${prefix}td join* / *${prefix}td leave* — lobby fallback if poll voting is inconvenient`,
    `*${prefix}td close* — starter/admin closes lobby early`,
    `*${prefix}td status* · *${prefix}td score* · *${prefix}td board* · *${prefix}td stats*`,
    `*${prefix}td next* · *${prefix}td stop* — starter/admin controls`,
    "",
    "*During your turn:* type `truth`, `dare`, or `skip` normally.",
    "For Truth, your next normal text answer completes the turn.",
    "For Dare, type `done` after completing it, or `skip`.",
    "",
    `Scoring: Truth *${TRUTH_POINTS}* · Dare *${DARE_POINTS}* · streak +2/+4/+6 · perfect run +${PERFECT_BONUS}.`,
  ],
  footer: "The game starter is auto-enrolled, so an admin can start the game and still participate normally.",
});
