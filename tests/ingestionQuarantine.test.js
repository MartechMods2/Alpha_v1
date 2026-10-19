import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { MessageQuarantine } from "../utils/ingestionQuarantine.js";
test("watchdog quarantine survives process reinitialization without storing private message fields", async () => {
  const directory = await mkdtemp(join(tmpdir(), "alpha-quarantine-"));
  let clock = 1000;
  try {
    const path = join(directory, "state.json"),
      hash = createHash("sha256").update("synthetic-identity").digest("hex");
    const first = new MessageQuarantine(path, () => clock);
    await first.load();
    await first.block(hash);
    const second = new MessageQuarantine(path, () => clock);
    await second.load();
    assert.equal(second.has(hash), true);
    const data = await readFile(path, "utf8");
    assert.ok(!data.includes("synthetic-identity"));
    assert.deepEqual(Object.keys(JSON.parse(data)[0]).sort(), [
      "hash",
      "until",
    ]);
    clock += 86400001;
    assert.equal(second.has(hash), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
