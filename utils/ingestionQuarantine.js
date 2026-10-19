import "dotenv/config";
import {
  readFile,
  stat,
  mkdir,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
export class MessageQuarantine {
  constructor(path, clock = Date.now) {
    this.path = path;
    this.clock = clock;
    this.entries = new Map();
    this.writes = Promise.resolve();
    this.loaded = false;
  }
  async load() {
    if (this.loaded) return;
    let data;
    try {
      const info = await stat(this.path);
      if (!info.isFile() || info.size > 131072)
        throw Error("Invalid quarantine storage");
      data = await readFile(this.path);
    } catch (error) {
      if (error.code === "ENOENT") {
        this.loaded = true;
        return;
      }
      throw Error("Quarantine storage unavailable");
    }
    if (data.length > 131072) throw Error("Quarantine record exceeds limit");
    const rows = JSON.parse(data.toString());
    if (!Array.isArray(rows) || rows.length > 1024)
      throw Error("Invalid quarantine record");
    this.entries.clear();
    for (const row of rows)
      if (
        typeof row?.hash === "string" &&
        /^[a-f0-9]{64}$/.test(row.hash) &&
        Number.isSafeInteger(row.until) &&
        row.until > this.clock()
      )
        this.entries.set(row.hash, row.until);
    this.loaded = true;
  }
  has(hash) {
    const until = this.entries.get(hash) || 0;
    if (until <= this.clock()) {
      this.entries.delete(hash);
      return false;
    }
    return true;
  }
  block(hash) {
    if (!/^[a-f0-9]{64}$/.test(hash))
      return Promise.reject(Error("Invalid quarantine identity"));
    for (const [key, until] of this.entries)
      if (until <= this.clock()) this.entries.delete(key);
    while (this.entries.size >= 1024)
      this.entries.delete(this.entries.keys().next().value);
    this.entries.set(hash, this.clock() + 86400000);
    const write = async () => {
      const temporary = this.path + "." + randomUUID() + ".tmp";
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      try {
        await writeFile(
          temporary,
          JSON.stringify(
            [...this.entries].map(([hash, until]) => ({ hash, until })),
          ),
          { mode: 0o600 },
        );
        await rename(temporary, this.path);
      } finally {
        await unlink(temporary).catch(() => {});
      }
    };
    this.writes = this.writes.catch(() => {}).then(write);
    return this.writes;
  }
}
export const messageQuarantine = new MessageQuarantine(
  resolve(
    process.env.ALPHA_INGEST_QUARANTINE_FILE || "temp/ingest-quarantine.json",
  ),
);
export function quarantineAndRestart(hash) {
  let timer;
  Promise.race([
    messageQuarantine.block(hash).catch(() => {}),
    new Promise((resolve) => {
      timer = setTimeout(resolve, 2000);
    }),
  ]).finally(() => {
    clearTimeout(timer);
    process.emit("alpha:fatal", "handler-deadline");
  });
}
