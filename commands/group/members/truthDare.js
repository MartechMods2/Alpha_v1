import {
  closeTruthDareLobby,
  forceNextTruthDareTurn,
  handleTruthDareAction,
  joinTruthDareLobby,
  leaveTruthDareLobby,
  startTruthDareSession,
  stopTruthDareSession,
  truthDareHelpText,
  truthDarePersistentBoardText,
  truthDareProfileText,
  truthDareScoreText,
  truthDareStatusText,
} from "../../../utils/truthDareHost.js";

const THEMES = new Set(["classic", "funny", "deep", "friendship", "tech", "random"]);

const parseStart = (args = []) => {
  let rounds = 2;
  let theme = "classic";
  for (const raw of args) {
    const value = String(raw || "").toLowerCase();
    if (/^[1-4]$/.test(value)) rounds = Number(value);
    else if (THEMES.has(value)) theme = value;
  }
  return { rounds, theme };
};

const handler = async (sock, msg, from, args, info) => {
  const {
    senderJid,
    updateName,
    groupMetadata,
    isGroupAdmin,
    isOwner,
    sendMessageWTyping,
    prefix = process.env.PREFIX || "$",
  } = info;
  const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
  const action = String(args[0] || "help").toLowerCase();

  try {
    if (["help", "guide", "commands"].includes(action)) {
      return reply(truthDareHelpText(prefix));
    }

    if (["start", "begin", "host"].includes(action)) {
      const { rounds, theme } = parseStart(args.slice(1));
      return startTruthDareSession({
        sock,
        msg,
        groupJid: from,
        starterJid: senderJid,
        starterName: updateName || msg?.pushName || "",
        groupMetadata,
        rounds,
        theme,
        sendMessageWTyping,
      });
    }

    if (action === "join") {
      const result = await joinTruthDareLobby({
        groupJid: from,
        senderJid,
        senderName: updateName || msg?.pushName || "",
      });
      return reply(result.message);
    }

    if (["leave", "sitout"].includes(action)) {
      const result = leaveTruthDareLobby({ groupJid: from, senderJid });
      return reply(result.message);
    }

    if (["close", "closelobby"].includes(action)) {
      const result = await closeTruthDareLobby({ sock, groupJid: from, senderJid, isGroupAdmin, isOwner });
      if (result.message) return reply(result.message);
      return;
    }

    if (["stop", "end", "finishgame"].includes(action)) {
      const result = await stopTruthDareSession({ sock, groupJid: from, senderJid, isGroupAdmin, isOwner });
      if (result.message) return reply(result.message);
      return;
    }

    if (["next", "skipturn"].includes(action)) {
      const result = await forceNextTruthDareTurn({ sock, groupJid: from, senderJid, isGroupAdmin, isOwner });
      if (result.message) return reply(result.message);
      return;
    }

    if (["status", "state"].includes(action)) return reply(truthDareStatusText(from));
    if (["score", "scores", "liveboard"].includes(action)) return reply(truthDareScoreText(from));
    if (["board", "leaderboard", "ranking"].includes(action)) return reply(await truthDarePersistentBoardText(from));
    if (["stats", "profile", "card"].includes(action)) {
      return reply(await truthDareProfileText(from, senderJid, updateName || msg?.pushName || ""));
    }

    if (["truth", "t", "dare", "d", "skip", "s", "pass", "done", "complete", "completed", "finished"].includes(action)) {
      const handled = await handleTruthDareAction({
        sock,
        groupJid: from,
        senderJid,
        body: action,
        fromCommand: true,
      });
      if (!handled) return reply("🎭 That action does not match your current Truth or Dare turn. Use `$td status`.");
      return;
    }

    if (action === "answer") {
      const body = args.slice(1).join(" ").trim();
      if (!body) return reply(`❌ Usage: *${prefix}td answer <your truth answer>*`);
      const handled = await handleTruthDareAction({
        sock,
        groupJid: from,
        senderJid,
        body,
        fromCommand: true,
      });
      if (!handled) return reply("🎭 Alpha is not waiting for your Truth answer right now.");
      return;
    }

    return reply(truthDareHelpText(prefix));
  } catch (error) {
    console.error("[TRUTH_DARE] command failed:", error.message);
    return reply("❌ Truth or Dare hit a temporary error. The current session was not intentionally stopped.");
  }
};

export default () => ({
  cmd: ["td", "truthdare", "truthordare", "tord"],
  desc: "Alpha-hosted Truth or Dare with lobby, automatic turns, timers, scoring, stats and winner",
  usage: "td start [1-4] [classic|funny|deep|friendship|tech|random] | td join | td score | td stop",
  handler,
});
