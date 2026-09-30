import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const set = (object, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((row, key) => row[key] ||= {}, object);
  target[last] = value;
};
// Evaluate the Mongo expressions used by the real score pipeline, applying each
// stage to one immutable input just as MongoDB does. No database is contacted.
const evaluate = (expression, row, variables = {}) => {
  if (typeof expression === "string" && expression.startsWith("$$")) return expression === "$$NOW" ? new Date() : variables[expression.slice(2)];
  if (typeof expression === "string" && expression.startsWith("$")) return get(row, expression.slice(1));
  if (Array.isArray(expression)) return expression.map(value => evaluate(value, row, variables));
  if (!expression || typeof expression !== "object") return expression;
  const [operation, args] = Object.entries(expression)[0];
  if (operation === "$literal") return args;
  if (operation === "$ifNull") { const [value, fallback] = evaluate(args, row, variables); return value ?? fallback; }
  if (operation === "$add") return evaluate(args, row, variables).reduce((sum, value) => sum + value, 0);
  if (operation === "$in") { const [value, list] = evaluate(args, row, variables); return list.includes(value); }
  if (operation === "$ne") { const [left, right] = evaluate(args, row, variables); return left !== right; }
  if (operation === "$cond") return evaluate(evaluate(args[0], row, variables) ? args[1] : args[2], row, variables);
  if (operation === "$max") return Math.max(...evaluate(args, row, variables));
  if (operation === "$concatArrays") return evaluate(args, row, variables).flat();
  if (operation === "$slice") { const [list, count] = evaluate(args, row, variables); return count < 0 ? list.slice(count) : list.slice(0, count); }
  if (operation === "$filter") return evaluate(args.input, row, variables).filter(value => evaluate(args.cond, row, { ...variables, [args.as]: value }));
  throw new Error(`Unsupported expression: ${operation}`);
};

test("hosted result retries do not duplicate points, plays, wins or streaks", async t => {
  const rows = new Map();
  globalThis.__alphaScoreCollection = {
    async findOneAndUpdate(filter, pipeline) {
      let row = structuredClone(rows.get(filter._id) || { _id: filter._id });
      for (const stage of pipeline) {
        const original = structuredClone(row);
        for (const [path, expression] of Object.entries(stage.$set)) set(row, path, evaluate(expression, original));
      }
      rows.set(filter._id, row);
      return row;
    },
  };
  t.after(() => { delete globalThis.__alphaScoreCollection; });
  const stub = `data:text/javascript;base64,${Buffer.from("export default {db: () => ({collection: () => globalThis.__alphaScoreCollection})};").toString("base64")}`;
  const source = (await readFile(new URL("../db/gameData.js", import.meta.url), "utf8")).replace('from "./client.js"', `from "${stub}"`);
  const db = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const result = { groupJid: "score@g.us", memberJid: "111@s.whatsapp.net", name: "Admin", game: "trivia", points: 10, won: true, correct: true, resultId: "session:turn:1" };
  await db.recordGameResult(result);
  const twice = await db.recordGameResult(result);
  assert.equal(twice.points, 10);
  assert.equal(twice.plays, 1);
  assert.equal(twice.wins, 1);
  assert.equal(twice.streak, 1);
  assert.equal(twice.byGame.trivia, 10);
  const next = await db.recordGameResult({ ...result, resultId: "session:turn:2" });
  assert.equal(next.points, 20);
  assert.equal(next.streak, 2);
  const total = await db.recordGameResult({ ...result, game: "truthdare", points: 203, resultId: "td:session:player" });
  assert.equal(total.byGame.truthdare, 203, "multi-round Truth or Dare totals are not clipped to 100");
});
