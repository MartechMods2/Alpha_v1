import { safePackItems } from "../../../db/safePackData.js";
import {
  newGame,
  move2048,
  addTile,
  openMine,
  renderGame,
  game2048Status,
} from "../../../utils/compactGames.js";
import { randomInt } from "node:crypto";
const handler = async (sock, msg, from, args, info) => {
  const type = info.command,
    action = args[0] || "status",
    key = `compact:${from}:${info.senderJid}:${type}`;
  const reply = (text) =>
    info.sendMessageWTyping(from, { text }, { quoted: msg });
  let row = await safePackItems.findOne({ _id: key });
  if (action === "start") {
    const payload = newGame(type);
    await safePackItems.updateOne(
      { _id: key },
      {
        $set: {
          groupJid: from,
          type: "compact-game",
          memberJid: info.senderJid,
          text: type,
          payload,
          updatedAt: new Date(),
          status: "active",
        },
        $inc: { version: 1 },
      },
      { upsert: true },
    );
    return reply(renderGame(type, payload));
  }
  if (!row)
    return reply(`Start with ${type} start. Each player has a separate game.`);
  if (action === "stop") {
    await safePackItems.deleteOne({ _id: key });
    return reply("Game stopped.");
  }
  let g = structuredClone(row.payload);
  if (action !== "status") {
    if (type === "2048") {
      if (g.status) return reply("Game " + g.status + ". Use 2048 start.");
      if (!["left", "right", "up", "down"].includes(action))
        return reply("Moves: left, right, up, down.");
      const move = move2048(g.board, action);
      if (move.changed) {
        g.board = addTile(move.board);
        g.score += move.score;
        g.status = game2048Status(g.board);
      }
    }
    if (type === "minesweeper") {
      if (action !== "open") return reply("Use minesweeper open <1-25>.");
      try {
        g = openMine(g, Number(args[1]) - 1);
      } catch (e) {
        return reply(e.message);
      }
    }
    if (type === "dungeon") {
      if (g.status !== "active")
        return reply("Adventure ended. Use dungeon start.");
      if (action === "rest") g.hp = Math.min(100, g.hp + 10);
      else if (action === "explore") {
        g.rooms++;
        g.hp = Math.max(0, g.hp - randomInt(5, 26));
        g.gold += randomInt(5, 31);
        if (g.hp === 0) g.status = "defeated";
        else if (g.rooms >= 10) g.status = "completed";
      } else return reply("Use dungeon explore or dungeon rest.");
    }
    const result = await safePackItems.updateOne(
      { _id: key, version: row.version },
      { $set: { payload: g, updatedAt: new Date() }, $inc: { version: 1 } },
    );
    if (!result.modifiedCount)
      return reply("Another move was processed first. Use status and retry.");
  }
  return reply(renderGame(type, g));
};
export default () => ({
  cmd: ["2048", "minesweeper", "dungeon"],
  desc: "Independent saved 2048, Minesweeper and dungeon adventures",
  usage: "2048 start | minesweeper start | minesweeper open 12 | dungeon start",
  handler,
});
