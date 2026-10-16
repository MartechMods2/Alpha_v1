import test from "node:test";
import assert from "node:assert/strict";
import {
  premiumReply,
  containsBannedPhrase,
  mentionIds,
} from "../utils/premiumReplies.js";
import {
  move2048,
  newGame,
  openMine,
  mineNeighbors,
  game2048Status,
} from "../utils/compactGames.js";
import { publicRepo, publicRequest } from "../utils/featureHttp.js";
test("word bans use literal normalized whole words without accidental substring matches", () => {
  assert.equal(containsBannedPhrase("This is BAD!", "bad"), true);
  assert.equal(containsBannedPhrase("badminton", "bad"), false);
  assert.equal(containsBannedPhrase("b\u200bad", "bad"), true);
  assert.equal(containsBannedPhrase("hello a+b world", "a+b"), true);
  assert.equal(containsBannedPhrase("hello aab world", "a+b"), false);
  assert.equal(containsBannedPhrase("HELLO   WORLD", "hello world"), true);
});
test("compact mentions support PN and LID, deduplicate and exclude group identifiers", () => {
  assert.deepEqual(
    mentionIds({
      participants: [
        { id: "1@lid" },
        { id: "1@lid" },
        { id: "2@s.whatsapp.net" },
        { phoneNumber: "3@s.whatsapp.net" },
        { id: "group@g.us" },
      ],
    }),
    ["1@lid", "2@s.whatsapp.net", "3@s.whatsapp.net"],
  );
});
test("premium replies preserve commands, links, code and avoid repeated decoration", () => {
  const body = "✅ Saved\n\n$example https://example.com";
  const result = premiumReply(body);
  assert.ok(result.includes("$example https://example.com"));
  assert.equal(premiumReply(result), result);
  assert.equal(premiumReply("```\ncode\n```"), "```\ncode\n```");
});
test("2048 merges each tile once in all directions and does not mutate the original", () => {
  const board = [2, 2, 2, 2, ...Array(12).fill(0)];
  const result = move2048(board, "left");
  assert.deepEqual(result.board.slice(0, 4), [4, 4, 0, 0]);
  assert.equal(result.score, 8);
  assert.deepEqual(board.slice(0, 4), [2, 2, 2, 2]);
  assert.deepEqual(move2048(board, "right").board.slice(0, 4), [0, 0, 4, 4]);
  const vertical = [2, 0, 0, 0, 2, 0, 0, 0, ...Array(8).fill(0)];
  assert.equal(move2048(vertical, "up").board[0], 4);
  assert.equal(move2048(vertical, "down").board[12], 4);
});
test("minesweeper starts safely, excludes wraparound neighbors, and supports win/loss", () => {
  for (let i = 0; i < 25; i++) {
    const g = openMine(newGame("minesweeper"), i);
    assert.equal(g.mines.includes(i), false);
    assert.equal(new Set(g.mines).size, 5);
  }
  assert.deepEqual(
    mineNeighbors(4).sort((a, b) => a - b),
    [3, 8, 9],
  );
  assert.throws(() => openMine(newGame("minesweeper"), 30));
  const g = { started: true, mines: [0, 1, 2, 3, 4], opened: [] };
  assert.equal(openMine(g, 0).status, "lost");
  let s = g;
  for (let i = 5; i < 25; i++) s = openMine(s, i);
  assert.equal(s.status, "won");
});
test("repository and URL validation reject credentials, private destinations and unexpected schemas", async () => {
  assert.equal(
    publicRepo("https://github.com/MartechMods2/Alpha_v1.git"),
    "MartechMods2/Alpha_v1",
  );
  for (const bad of [
    "https://evil.test/a/b",
    "../repo",
    "a/..",
    "a/repo?token=secret",
  ])
    assert.throws(() => publicRepo(bad));
  for (const bad of [
    "http://example.com",
    "https://user:secret@example.com",
    "https://127.0.0.1",
    "https://[::1]",
    "https://example.com:444",
  ])
    await assert.rejects(publicRequest(bad));
});
test("membership fulfillment requires live currency, exact amount and account/group binding", async () => {
  const { validMembershipPayment } = await import(
    "../utils/membershipPayments.js"
  );
  const order = {
    _id: "alpha-reference",
    memberJid: "one@lid",
    groupJid: "group@g.us",
    amountKobo: 200000,
  };
  const transaction = {
    id: 123,
    status: "success",
    domain: "live",
    currency: "NGN",
    amount: 200000,
    reference: order._id,
    metadata: {
      alpha_member: "one@lid",
      alpha_group: "group@g.us",
      alpha_product: "group-membership",
    },
  };
  assert.equal(validMembershipPayment(transaction, order), true);
  for (const patch of [
    { domain: "test" },
    { amount: 2000 },
    { currency: "USD" },
    { reference: "other" },
    { status: "pending" },
    { metadata: { ...transaction.metadata, alpha_member: "two@lid" } },
  ])
    assert.equal(
      validMembershipPayment({ ...transaction, ...patch }, order),
      false,
    );
});

test("2048 detects won and immovable boards while permitting remaining merges", () => {
  assert.equal(game2048Status([2048, ...Array(15).fill(0)]), "won");
  const full = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
  assert.equal(game2048Status(full), "lost");
  full[0] = 4;
  assert.equal(game2048Status(full), null);
});

test("premium frame replaces provider branding once and preserves conversational text", () => {
  const body = "Rest mode? No be like say you dey chill for shade. 😎🛋️";
  for (const label of ["⚡Alpha⚡", "*ALPHA*", "✦ Alpha ✦"]) {
    const result = premiumReply(label + "\n\n" + body);
    assert.equal((result.match(/alpha/gi) || []).length, 1);
    assert.ok(result.includes(body));
    assert.equal(premiumReply(result), result);
  }
  assert.ok(
    premiumReply("Alpha can help you with this.").includes(
      "Alpha can help you with this.",
    ),
  );
  assert.ok(
    premiumReply("✅ Saved\n\n$ban example").includes(
      "✅ Saved\n\n$ban example",
    ),
  );
});
