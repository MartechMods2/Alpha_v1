import { randomInt } from "node:crypto";
export function move2048(board, direction) {
  const indexes = Array.from({ length: 4 }, (_, n) =>
    Array.from({ length: 4 }, (_, m) =>
      direction === "left"
        ? n * 4 + m
        : direction === "right"
          ? n * 4 + 3 - m
          : direction === "up"
            ? m * 4 + n
            : (3 - m) * 4 + n,
    ),
  );
  const result = board.slice();
  let score = 0;
  for (const row of indexes) {
    const values = row.map((i) => board[i]).filter(Boolean),
      merged = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        merged.push(values[i] * 2);
        score += values[i] * 2;
        i++;
      } else merged.push(values[i]);
    }
    while (merged.length < 4) merged.push(0);
    row.forEach((id, n) => (result[id] = merged[n]));
  }
  return {
    board: result,
    score,
    changed: result.some((x, i) => x !== board[i]),
  };
}
export function game2048Status(board) {
  if (board.some((x) => x >= 2048)) return "won";
  if (
    ["left", "right", "up", "down"].every(
      (direction) => !move2048(board, direction).changed,
    )
  )
    return "lost";
  return null;
}
export function addTile(board) {
  const free = board.map((x, i) => (x === 0 ? i : -1)).filter((i) => i >= 0);
  if (free.length)
    board[free[randomInt(free.length)]] = randomInt(10) === 0 ? 4 : 2;
  return board;
}
export function newGame(type) {
  if (type === "2048")
    return { board: addTile(addTile(Array(16).fill(0))), score: 0 };
  if (type === "minesweeper") return { mines: [], opened: [], started: false };
  return { hp: 100, gold: 0, rooms: 0, status: "active" };
}
export function mineNeighbors(cell) {
  const x = cell % 5,
    y = Math.floor(cell / 5);
  return Array.from({ length: 25 }, (_, i) => i).filter(
    (i) =>
      i !== cell &&
      Math.abs((i % 5) - x) <= 1 &&
      Math.abs(Math.floor(i / 5) - y) <= 1,
  );
}
export function openMine(game, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell > 24)
    throw Error("Choose a cell from 1 to 25.");
  const g = structuredClone(game);
  if (g.status) return g;
  if (!g.started) {
    const allowed = Array.from({ length: 25 }, (_, i) => i).filter(
      (i) => i !== cell,
    );
    while (g.mines.length < 5)
      g.mines.push(allowed.splice(randomInt(allowed.length), 1)[0]);
    g.started = true;
  }
  if (g.mines.includes(cell)) {
    g.status = "lost";
    return g;
  }
  const visit = [cell],
    seen = new Set(g.opened);
  while (visit.length) {
    const next = visit.pop();
    if (seen.has(next) || g.mines.includes(next)) continue;
    seen.add(next);
    const neighbors = mineNeighbors(next);
    if (!neighbors.some((i) => g.mines.includes(i))) visit.push(...neighbors);
  }
  g.opened = [...seen];
  if (g.opened.length === 20) g.status = "won";
  return g;
}
export function renderGame(type, g) {
  if (type === "2048")
    return (
      `2048 • Score ${g.score} • ${g.status || "active"}\n\n` +
      "```\n" +
      Array.from({ length: 4 }, (_, r) =>
        g.board
          .slice(r * 4, r * 4 + 4)
          .map((x) => String(x || "·").padStart(4))
          .join(" "),
      ).join("\n") +
      "\n```\n\n2048 left|right|up|down • 2048 stop"
    );
  if (type === "minesweeper")
    return (
      `Minesweeper • ${g.status || "active"}\n\n` +
      Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => {
          const i = r * 5 + c;
          return g.opened.includes(i)
            ? String(mineNeighbors(i).filter((n) => g.mines.includes(n)).length)
            : g.status && g.mines.includes(i)
              ? "💣"
              : String(i + 1).padStart(2, "0");
        }).join(" "),
      ).join("\n") +
      "\n\nminesweeper open <1-25> • minesweeper stop"
    );
  return `Dungeon • ${g.status}\nHP ${g.hp} • Gold ${g.gold} • Rooms ${g.rooms}\n\ndungeon explore|rest|status|stop`;
}
