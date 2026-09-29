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
const MAX_ROUNDS = 5;
const TRUTH_POINTS = 10;
const DARE_POINTS = 15;
const PERFECT_BONUS = 5;
const JOIN_OPTION = "✅ Join game";
const SKIP_OPTION = "⏭️ Sit this one out";

const clean = (value, max = 300) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const sendQueued = (sock, jid, content, options = {}) =>
  messageQueue.enqueue(jid, () => sock.sendMessage(jid, content, options), 1);

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const participantFromJid = (metadata, jid, nameHint = "", previous = null) => {
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
    aliases: [...new Set([canonical, ...(previous?.aliases || []), ...aliases].filter(Boolean))],
    name: safeDisplayName(
      nameHint ||
      previous?.name ||
      participant?.notify ||
      participant?.name ||
      participant?.verifiedName ||
      "",
      canonical,
    ),
    score: Number(previous?.score || 0),
    truths: Number(previous?.truths || 0),
    dares: Number(previous?.dares || 0),
    skips: Number(previous?.skips || 0),
    timeouts: Number(previous?.timeouts || 0),
    completed: Number(previous?.completed || 0),
    streak: Number(previous?.streak || 0),
    bestStreak: Number(previous?.bestStreak || 0),
    perfectBonus: Number(previous?.perfectBonus || 0),
  };
};

const samePlayer = (session, senderJid, player) => {
  if (!player || !senderJid) return false;
  const normalized = normalizeUserJid(senderJid);
  if ((player.aliases || []).includes(normalized)) return true;
  return isSameGroupUser(session.groupMetadata, senderJid, player.aliases || [player.jid]);
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
  void persistSession(session);
  return player;
};

const removeParticipant = (session, jid) => {
  const index = session.participants.findIndex((player) => samePlayer(session, jid, player));
  if (index < 0) return false;
  session.participants.splice(index, 1);
  void persistSession(session);
  return true;
};

const currentPlayer = (session) => session.turnOrder[session.currentIndex] || null;
const formatPlayerMention = (player) => `@${String(player?.jid || "").split("@")[0]}`;

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
    footer: `Round ${Math.min(session.currentRound, session.rounds)}/${session.rounds} · Truth ${TRUTH_POINTS} pts · Dare ${DARE_POINTS} pts · streak +2/+4/+6`,
  });

const promptFromDeck = (session, type) => {
  const key = type === "dare" ? "dareDeck" : "truthDeck";
  if (!session[key]?.length) session[key] = buildTruthDareDeck({ theme: session.theme, type });
  return session[key].shift();
};

const turnPoints = (player, type) => {
  player.streak += 1;
  player.bestStreak = Math.max(player.bestStreak, player.streak);
  const base = type === "dare" ? DARE_POINTS : TRUTH_POINTS;
  const streakBonus = Math.min(6, Math.max(0, player.streak - 1) * 2);
  return { base, streakBonus, total: base + streakBonus };
};

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
  truthDeck: [...(session.truthDeck || [])],
  dareDeck: [...(session.dareDeck || [])],
  pollId: session.pollId || "",
  timerToken: session.timerToken || 0,
  startedAt: session.startedAt,
  phaseExpiresAt: session.phaseExpiresAt || 0,
  choice: session.choice || "",
  currentPrompt: session.currentPrompt || "",
  promptMessageId: session.promptMessageId || "",
  turnMessageId: session.turnMessageId || "",
});

async function persistSession(session) {
  if (!session || session.status === "finished") return;
  try {
    await saveTruthDareSessionSnapshot(session.groupJid, snapshotOf(session));
  } catch (error) {
    console.warn("[TRUTH_DARE] session snapshot failed:", error.message);
  }
}

const clearTimer = (session) => {
  if (session?.timer) clearTimeout(session.timer);
  if (session) {
    session.timer = null;
    session.phaseExpiresAt = 0;
  }
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

const sessionIsExpired = (session) => Date.now() - Number(session.startedAt || 0) > SESSION_TTL_MS;

const cleanupExpiredSession = async (sock, session) => {
  if (!sessionIsExpired(session)) return false;
  clearTimer(session);
  sessions.delete(session.groupJid);
  await deleteTruthDareSessionSnapshot(session.groupJid).catch(() => {});
  if (session.pollId) await finishInteractivePoll(session.pollId, { result: "truth-dare-expired" }).catch(() => {});
  await sendQueued(sock, session.groupJid, {
    text: "⌛ *Truth or Dare expired after 50 minutes.* Start a fresh game with `$td start`.",
  }).catch(() => {});
  return true;
};

const resolveRecoveredTurnOrder = (participants, ids = []) => {
  const used = new Set();
  const rows = [];
  for (const id of ids) {
    const normalized = normalizeUserJid(id);
    const player = participants.find((entry) =>
      entry.jid === id || entry.aliases.includes(normalized));
    if (player && !used.has(player.jid)) {
      used.add(player.jid);
      rows.push(player);
    }
  }
  return rows;
};

async function onChoiceTimeout(sock, session, expectedRound, expectedIndex) {
  if (!sessions.has(session.groupJid)) return;
  if (session.phase !== "choice" || session.currentRound !== expectedRound || session.currentIndex !== expectedIndex) return;
  const player = currentPlayer(session);
  if (!player) return startNextTurn(sock, session);
  player.timeouts += 1;
  player.streak = 0;
  session.phase = "transition";
  session.currentIndex += 1;
  await persistSession(session);
  await sendQueued(sock, session.groupJid, {
    text: `⌛ ${formatPlayerMention(player)} did not choose in time. *0 points.*\n${truthDareReaction("timeout")}`,
    mentions: [player.jid],
  });
  await startNextTurn(sock, session);
}

async function onResponseTimeout(sock, session, expectedRound, expectedIndex) {
  if (!sessions.has(session.groupJid)) return;
  if (session.phase !== "response" || session.currentRound !== expectedRound || session.currentIndex !== expectedIndex) return;
  const player = currentPlayer(session);
  if (!player) return startNextTurn(sock, session);
  player.timeouts += 1;
  player.streak = 0;
  session.phase = "transition";
  session.currentIndex += 1;
  await persistSession(session);
  await sendQueued(sock, session.groupJid, {
    text: `⌛ ${formatPlayerMention(player)} ran out of time. *0 points.*\n${truthDareReaction("timeout")}`,
    mentions: [player.jid],
  });
  await startNextTurn(sock, session);
}

async function rearmRecoveredSession(sock, session) {
  if (await cleanupExpiredSession(sock, session)) return;
  const remaining = Math.max(250, Number(session.phaseExpiresAt || 0) - Date.now());

  if (session.status === "lobby") {
    schedule(session, remaining, () => closeLobbyInternal(sock, session));
    return;
  }
  if (session.status !== "playing") return;

  if (session.phase === "choice") {
    schedule(session, remaining, () => onChoiceTimeout(sock, session, session.currentRound, session.currentIndex));
    return;
  }
  if (session.phase === "response") {
    schedule(session, remaining, () => onResponseTimeout(sock, session, session.currentRound, session.currentIndex));
    return;
  }

  // A restart during a transition/loading window should never freeze the game.
  setTimeout(() => {
    startNextTurn(sock, session).catch((error) =>
      console.warn("[TRUTH_DARE] recovered transition failed:", error.message));
  }, 250).unref?.();
}

export const restoreTruthDareSession = async ({ sock, groupJid }) => {
  if (sessions.has(groupJid)) return sessions.get(groupJid);
  const snapshot = await getTruthDareSessionSnapshot(groupJid).catch(() => null);
  if (!snapshot) return null;
  if (!["lobby", "playing"].includes(snapshot.status)) {
    await deleteTruthDareSessionSnapshot(groupJid).catch(() => {});
    return null;
  }

  const metadata = await sock.groupMetadata(groupJid).catch(() => null);
  if (!metadata) return null;
  const participants = (snapshot.participants || []).map((player) =>
    participantFromJid(metadata, player.jid, player.name, player));
  if (!participants.length) {
    await deleteTruthDareSessionSnapshot(groupJid).catch(() => {});
    return null;
  }

  const session = {
    id: snapshot.id || `${Date.now()}:recovered`,
    groupJid,
    groupMetadata: metadata,
    status: snapshot.status,
    phase: snapshot.phase || (snapshot.status === "lobby" ? "lobby" : "transition"),
    startedBy: snapshot.startedBy || participants[0].jid,
    participants,
    turnOrder: resolveRecoveredTurnOrder(participants, snapshot.turnOrderJids || []),
    currentRound: Math.max(1, Number(snapshot.currentRound || 1)),
    currentIndex: Math.max(0, Number(snapshot.currentIndex || 0)),
    rounds: Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Number(snapshot.rounds || 2))),
    theme: normalizeTruthDareTheme(snapshot.theme),
    truthDeck: Array.isArray(snapshot.truthDeck) ? snapshot.truthDeck : [],
    dareDeck: Array.isArray(snapshot.dareDeck) ? snapshot.dareDeck : [],
    pollId: snapshot.pollId || "",
    timer: null,
    timerToken: Number(snapshot.timerToken || 0),
    startedAt: Number(snapshot.startedAt || Date.now()),
    phaseExpiresAt: Number(snapshot.phaseExpiresAt || 0),
    choice: snapshot.choice || "",
    currentPrompt: snapshot.currentPrompt || "",
    promptMessageId: snapshot.promptMessageId || "",
    turnMessageId: snapshot.turnMessageId || "",
  };

  if (session.status === "playing" && !session.turnOrder.length) {
    session.turnOrder = shuffle(session.participants);
    session.currentIndex = 0;
    session.phase = "transition";
  }

  sessions.set(groupJid, session);
  await rearmRecoveredSession(sock, session);
  return session;
};

const finishSession = async (sock, session, { stopped = false } = {}) => {
  clearTimer(session);
  session.status = "finished";

  for (const player of session.participants) {
    const perfect = !stopped &&
      player.completed === session.rounds &&
      player.skips === 0 &&
      player.timeouts === 0;
    if (perfect && !player.perfectBonus) {
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
  await deleteTruthDareSessionSnapshot(session.groupJid).catch(() => {});

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
        : "Alpha hosted every turn automatically. Use `$td board` for the permanent leaderboard.",
    }),
    mentions: winners.map((player) => player.jid),
  });
};

async function startNextTurn(sock, session) {
  if (!sessions.has(session.groupJid)) return;
  if (await cleanupExpiredSession(sock, session)) return;

  if (session.currentIndex >= session.turnOrder.length) {
    await sendQueued(sock, session.groupJid, {
      text: liveScorePanel(session, `Round ${session.currentRound} Complete`),
    });
    session.currentRound += 1;
    if (session.currentRound > session.rounds) return finishSession(sock, session);
    session.turnOrder = shuffle(session.participants);
    session.currentIndex = 0;
    session.phase = "transition";
    await persistSession(session);
    await sendQueued(sock, session.groupJid, {
      text: alphaPanel({
        icon: "⚡",
        title: `Round ${session.currentRound}/${session.rounds}`,
        lines: ["Alpha reshuffled the players.", truthDareReaction("next")],
        footer: "Truth and Dare are voluntary. Skip is always allowed.",
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
        "Type the word normally — no command prefix needed.",
      ],
      footer: `45 seconds · Truth ${TRUTH_POINTS} pts · Dare ${DARE_POINTS} pts`,
    }),
    mentions: [player.jid],
  });
  session.turnMessageId = sent?.key?.id || "";
  await persistSession(session);

  const expectedRound = session.currentRound;
  const expectedIndex = session.currentIndex;
  schedule(session, CHOICE_MS, () => onChoiceTimeout(sock, session, expectedRound, expectedIndex));
}

async function completeChoice(sock, session, player, choice) {
  clearTimer(session);
  session.choice = choice;

  if (choice === "skip") {
    player.skips += 1;
    player.streak = 0;
    session.phase = "transition";
    session.currentIndex += 1;
    await persistSession(session);
    await sendQueued(sock, session.groupJid, {
      text: `${truthDareReaction("skip")}\n${formatPlayerMention(player)} gets *0 points* this turn.`,
      mentions: [player.jid],
    });
    return startNextTurn(sock, session);
  }

  const prompt = promptFromDeck(session, choice);
  session.currentPrompt = prompt;
  session.phase = "response";
  const basePoints = choice === "dare" ? DARE_POINTS : TRUTH_POINTS;
  const instruction = choice === "truth"
    ? "Reply with your answer in the chat. Alpha scores completion, not whether your answer is 'true', and does not save the answer text."
    : "Complete the dare, then type *done*. Type *skip* at any time.";

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
        `Worth: *${basePoints} pts* + streak bonus`,
      ],
      footer: "90 seconds · voluntary · safe skips are always accepted",
    }),
    mentions: [player.jid],
  });
  session.promptMessageId = sent?.key?.id || "";
  await persistSession(session);

  const expectedRound = session.currentRound;
  const expectedIndex = session.currentIndex;
  schedule(session, RESPONSE_MS, () => onResponseTimeout(sock, session, expectedRound, expectedIndex));
}

async function completeResponse(sock, session, player, type) {
  clearTimer(session);
  session.phase = "transition";
  const earned = turnPoints(player, type);
  player.score += earned.total;
  player.completed += 1;
  if (type === "truth") player.truths += 1;
  else player.dares += 1;
  session.currentIndex += 1;
  await persistSession(session);

  await sendQueued(sock, session.groupJid, {
    text: `${truthDareReaction("complete")}\n${formatPlayerMention(player)} earns *+${earned.total} pts*${earned.streakBonus ? ` (*+${earned.streakBonus} streak bonus*)` : ""}.\nTotal: *${player.score} pts*.`,
    mentions: [player.jid],
  });
  await startNextTurn(sock, session);
}

async function closeLobbyInternal(sock, session) {
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
    await deleteTruthDareSessionSnapshot(session.groupJid).catch(() => {});
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
  await persistSession(session);

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
      footer: "Alpha hosts everything from here. The starter/admin can play normally too.",
    }),
  });

  await startNextTurn(sock, session);
  return true;
}

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
  const recovered = await restoreTruthDareSession({ sock, groupJid });
  if (recovered) {
    return sendMessageWTyping(groupJid, {
      text: recovered.status === "lobby"
        ? "🎭 A Truth or Dare lobby is already open. Use `$td join`, `$td close`, or `$td stop`."
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
    phaseExpiresAt: 0,
    choice: "",
    currentPrompt: "",
    promptMessageId: "",
    turnMessageId: "",
  };
  sessions.set(groupJid, session);

  try {
    const pollMessage = await sock.sendMessage(groupJid, {
      poll: {
        name: `🎭 Alpha Truth or Dare · ${safeRounds} round${safeRounds === 1 ? "" : "s"} · ${safeTheme}\nVote to join. The starter is already enrolled. Lobby closes in 30 seconds.`,
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
        `Starter: *${starter.name}* — auto-joined, so the admin/host can play too.`,
        `Theme: *${safeTheme}* · Rounds: *${safeRounds}*`,
        `Up to *${MAX_PLAYERS} players*.`,
        "",
        session.pollId
          ? "Everyone else: vote *Join game* in the poll or type `$td join`."
          : "Poll creation was unavailable, so everyone else should type `$td join`.",
        "Alpha will shuffle players, manage every turn, keep time, score the game and announce the winner automatically.",
        "",
        `🎯 Truth = *${TRUTH_POINTS} pts*`,
        `🔥 Dare = *${DARE_POINTS} pts*`,
        "⚡ Consecutive completed turns earn +2/+4/+6 streak bonuses.",
        `✨ Complete every round without skip/timeout for +${PERFECT_BONUS} bonus.`,
      ],
      footer: "Skip is always allowed. No negative points. Starter/admin can use `$td close` to close the lobby early.",
    }),
  }, { quoted: msg });

  await persistSession(session);
  schedule(session, LOBBY_MS, () => closeLobbyInternal(sock, session));
  return true;
};

export const joinTruthDareLobby = async ({ sock, groupJid, senderJid, senderName = "" }) => {
  const session = sessions.get(groupJid) || await restoreTruthDareSession({ sock, groupJid });
  if (!session || session.status !== "lobby") return { ok: false, message: "🎭 No Truth or Dare lobby is open." };
  const player = addParticipant(session, senderJid, senderName);
  if (!player) return { ok: false, message: `🎭 Lobby is full at ${MAX_PLAYERS} players.` };
  await persistSession(session);
  return { ok: true, message: `✅ *${player.name}* joined Truth or Dare. Players: *${session.participants.length}/${MAX_PLAYERS}*.` };
};

export const leaveTruthDareLobby = async ({ sock, groupJid, senderJid }) => {
  const session = sessions.get(groupJid) || await restoreTruthDareSession({ sock, groupJid });
  if (!session || session.status !== "lobby") return { ok: false, message: "🎭 No Truth or Dare lobby is open." };
  const removed = removeParticipant(session, senderJid);
  await persistSession(session);
  return {
    ok: removed,
    message: removed ? "⏭️ You left the Truth or Dare lobby." : "You were not in the Truth or Dare lobby.",
  };
};

export const closeTruthDareLobby = async ({ sock, groupJid, senderJid, isGroupAdmin = false, isOwner = false }) => {
  const session = sessions.get(groupJid) || await restoreTruthDareSession({ sock, groupJid });
  if (!session || session.status !== "lobby") return { ok: false, message: "🎭 No Truth or Dare lobby is open." };
  if (!isGroupAdmin && !isOwner && !samePlayer(session, senderJid, { aliases: [session.startedBy] })) {
    return { ok: false, message: "❌ Only the game starter, a group admin or the bot owner can close the lobby early." };
  }
  await closeLobbyInternal(sock, session);
  return { ok: true, message: "" };
};

export const stopTruthDareSession = async ({ sock, groupJid, senderJid, isGroupAdmin = false, isOwner = false }) => {
  const session = sessions.get(groupJid) || await restoreTruthDareSession({ sock, groupJid });
  if (!session) return { ok: false, message: "🎭 No Truth or Dare game is active." };
  const starter = { aliases: [session.startedBy] };
  if (!isGroupAdmin && !isOwner && !samePlayer(session, senderJid, starter)) {
    return { ok: false, message: "❌ Only the game starter, a group admin or the bot owner can stop this game." };
  }
  if (session.status === "lobby") {
    clearTimer(session);
    if (session.pollId) await finishInteractivePoll(session.pollId, { result: "truth-dare-stopped" }).catch(() => {});
    sessions.delete(groupJid);
    await deleteTruthDareSessionSnapshot(groupJid).catch(() => {});
    return { ok: true, message: "🛑 Truth or Dare lobby closed." };
  }
  await finishSession(sock, session, { stopped: true });
  return { ok: true, message: "" };
};

export const forceNextTruthDareTurn = async ({ sock, groupJid, senderJid, isGroupAdmin = false, isOwner = false }) => {
  const session = sessions.get(groupJid) || await restoreTruthDareSession({ sock, groupJid });
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
  await persistSession(session);
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
      `Turn: *${Math.min(session.currentIndex + 1, session.turnOrder.length)}/${session.turnOrder.length}*`,
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
  mediaResponse = false,
}) => {
  const session = sessions.get(groupJid) || await restoreTruthDareSession({ sock, groupJid });
  if (!session || session.status !== "playing") return false;
  if (sessionIsExpired(session)) {
    await cleanupExpiredSession(sock, session);
    return true;
  }

  const player = currentPlayer(session);
  if (!player || !samePlayer(session, senderJid, player)) return false;

  const raw = clean(body, 1200);
  const action = raw.toLowerCase().replace(/[.!?]+$/g, "").trim();

  if (session.phase === "choice") {
    if (["truth", "t"].includes(action)) {
      session.phase = "loading";
      await persistSession(session);
      await completeChoice(sock, session, player, "truth");
      return true;
    }
    if (["dare", "d"].includes(action)) {
      session.phase = "loading";
      await persistSession(session);
      await completeChoice(sock, session, player, "dare");
      return true;
    }
    if (["skip", "s", "pass"].includes(action)) {
      session.phase = "loading";
      await persistSession(session);
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
    session.currentIndex += 1;
    await persistSession(session);
    await sendQueued(sock, groupJid, {
      text: `${truthDareReaction("skip")}\n${formatPlayerMention(player)} gets *0 points* this turn.`,
      mentions: [player.jid],
    });
    await startNextTurn(sock, session);
    return true;
  }

  if (session.choice === "dare") {
    const mediaCompletesDare = mediaResponse && /\b(voice note|photo|picture|video|image|sticker)\b/i.test(session.currentPrompt || "");
    if (!mediaCompletesDare && !["done", "complete", "completed", "finished", "finish"].includes(action)) return false;
    await completeResponse(sock, session, player, "dare");
    return true;
  }

  if (mediaResponse) {
    await completeResponse(sock, session, player, "truth");
    return true;
  }

  if (!action) return false;
  const prefix = String(process.env.PREFIX || "$");
  if (!fromCommand && (raw.startsWith(prefix) || raw.startsWith("/") || raw.startsWith("#"))) return false;
  if (["done", "complete", "completed", "finished", "finish"].includes(action)) return false;

  const truthAnswer = action.startsWith("answer ") ? clean(raw.slice(7), 1200) : raw;
  if (!truthAnswer) return false;
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
    `*${prefix}td join* / *${prefix}td leave* — lobby fallback`,
    `*${prefix}td close* — starter/admin closes lobby early`,
    `*${prefix}td resume* — recover an interrupted session after a restart`,
    `*${prefix}td status* · *${prefix}td score* · *${prefix}td board* · *${prefix}td stats*`,
    `*${prefix}td next* · *${prefix}td stop* — starter/admin controls`,
    "",
    "*During your turn:* type `truth`, `dare`, or `skip` normally.",
    "Truth: send your answer normally, reply with a voice note, or use `td answer <text>`.",
    "Dare: type `done` after completing it. Matching media dares can complete when the media is sent.",
    "",
    `Scoring: Truth *${TRUTH_POINTS}* · Dare *${DARE_POINTS}* · streak +2/+4/+6 · perfect run +${PERFECT_BONUS}.`,
  ],
  footer: "The starter is auto-enrolled, so the admin can start the game and participate while Alpha hosts everything.",
});

export const truthDareRulesText = (prefix = "$") => alphaPanel({
  icon: "🛡️",
  title: "Truth or Dare Rules",
  lines: [
    "• Joining is voluntary.",
    "• Skip is always allowed and never gives negative points.",
    "• Alpha does not judge whether a Truth answer is honest; it only scores completion.",
    "• Dares are self-reported with `done`; Alpha does not require proof.",
    "• Unsafe, sexual, humiliating, illegal or privacy-invasive dares are not part of the prompt library.",
    "• Only the current player can advance their turn.",
    `• Starter/admin controls: *${prefix}td close*, *${prefix}td next*, *${prefix}td stop*.`,
  ],
});
