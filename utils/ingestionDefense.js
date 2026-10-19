import {
  messageQuarantine,
  quarantineAndRestart,
} from "./ingestionQuarantine.js";
import "dotenv/config";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
const integer = (env, name, fallback, min, max) => {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : fallback;
};
export function defenseConfig(env = process.env) {
  return Object.freeze({
    heapWarnMb: integer(env, "ALPHA_HEAP_WARN_MB", 256, 64, 16384),
    rssWarnMb: integer(env, "ALPHA_RSS_WARN_MB", 384, 128, 32768),
    mediaConcurrency: integer(env, "ALPHA_MEDIA_DOWNLOAD_CONCURRENCY", 4, 1, 4),
    mediaQueue: integer(env, "ALPHA_MEDIA_QUEUE", 16, 1, 64),
    mediaRetries: integer(env, "ALPHA_MEDIA_RETRY_TASKS", 2, 0, 10),
    mediaTimeout: integer(
      env,
      "ALPHA_MEDIA_DOWNLOAD_TIMEOUT_MS",
      30000,
      1000,
      60000,
    ),
    aiConcurrency: integer(env, "ALPHA_AI_MAX_CONCURRENT", 2, 1, 4),
    maxText: integer(env, "ALPHA_INGEST_TEXT_CHARS", 16384, 1024, 65536),
    maxNodes: integer(env, "ALPHA_INGEST_NODES", 2048, 128, 8192),
    maxDepth: integer(env, "ALPHA_INGEST_DEPTH", 12, 6, 24),
    maxBytes: integer(env, "ALPHA_INGEST_BYTES", 262144, 32768, 1048576),
    maxMedia: integer(env, "ALPHA_INGEST_MEDIA_MB", 32, 1, 64) * 1048576,
    batch: integer(env, "ALPHA_INGEST_BATCH", 128, 8, 512),
    queueTtl: integer(env, "ALPHA_INGEST_QUEUE_TTL_MS", 30000, 1000, 120000),
    concurrency: integer(env, "ALPHA_INGEST_CONCURRENCY", 4, 1, 16),
    queue: integer(env, "ALPHA_INGEST_QUEUE", 128, 8, 512),
    chatQueue: integer(env, "ALPHA_INGEST_CHAT_QUEUE", 16, 2, 64),
    deadline: integer(env, "ALPHA_INGEST_DEADLINE_MS", 180000, 1000, 300000),
    senderBurst: integer(env, "ALPHA_INGEST_SENDER_BURST", 12, 2, 100),
    chatBurst: integer(env, "ALPHA_INGEST_CHAT_BURST", 60, 10, 500),
    globalBurst: integer(env, "ALPHA_INGEST_GLOBAL_BURST", 200, 20, 2000),
    window: integer(env, "ALPHA_INGEST_WINDOW_MS", 10000, 1000, 60000),
    stateCap: integer(env, "ALPHA_INGEST_STATE_CAP", 10000, 100, 50000),
    dedupMs: integer(env, "ALPHA_INGEST_DEDUP_MS", 600000, 60000, 3600000),
  });
}
export const declaredMediaBytes = (value) => {
  try {
    if (value == null) return null;
    if (typeof value === "number")
      return Number.isSafeInteger(value) && value >= 0 ? value : Infinity;
    if (typeof value === "bigint" || typeof value === "string") {
      if (!/^\d{1,20}$/.test(String(value))) return Infinity;
      const n = BigInt(value);
      return n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : Infinity;
    }
    if (
      typeof value === "object" &&
      Number.isInteger(Object.getOwnPropertyDescriptor(value, "low")?.value) &&
      Number.isInteger(Object.getOwnPropertyDescriptor(value, "high")?.value)
    ) {
      const n =
        (BigInt(Object.getOwnPropertyDescriptor(value, "high").value >>> 0) <<
          32n) +
        BigInt(Object.getOwnPropertyDescriptor(value, "low").value >>> 0);
      return n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : Infinity;
    }
  } catch {}
  return Infinity;
};
const textKeys = new Set([
  "conversation",
  "text",
  "caption",
  "selectedDisplayText",
  "title",
  "description",
  "pushName",
]);
const mediaKeys = new Set([
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "stickerMessage",
  "documentMessage",
]);
const wrappers = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
];
export function validateMessage(input, config = defenseConfig()) {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input))
      return { ok: false, reason: "structure" };
    // Iterative descriptor-based copying does not invoke getters or toJSON hooks.
    const root = {};
    const stack = [{ source: input, target: root, depth: 0 }];
    const seen = new WeakSet();
    let nodes = 0,
      bytes = 0;
    while (stack.length) {
      const { source, target, depth } = stack.pop();
      if (depth > config.maxDepth || seen.has(source))
        return { ok: false, reason: "nesting" };
      seen.add(source);
      let keys = 0;
      for (const key in source) {
        if (!Object.hasOwn(source, key)) continue;
        if (
          ++keys > (Array.isArray(source) ? 1024 : 128) ||
          ++nodes > config.maxNodes ||
          key.length > 128
        )
          return { ok: false, reason: "shape-budget" };
        if (["__proto__", "constructor", "prototype"].includes(key))
          return { ok: false, reason: "unsafe-field" };
        const descriptor = Object.getOwnPropertyDescriptor(source, key);
        if (!descriptor || !("value" in descriptor))
          return { ok: false, reason: "accessor" };
        let value = descriptor.value;
        bytes += key.length * 2;
        if (typeof value === "string") {
          if (textKeys.has(key) && value.length > config.maxText)
            return { ok: false, reason: "text-size" };
          bytes += value.length * 2;
          if (textKeys.has(key))
            value = value
              .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
              .toWellFormed();
          target[key] = value;
        } else if (
          value == null ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          typeof value === "bigint"
        )
          target[key] = value;
        else if (value instanceof Uint8Array) {
          bytes += value.byteLength;
          target[key] = value;
        } else if (typeof value === "object") {
          if (Array.isArray(value) && value.length > 1024)
            return { ok: false, reason: "array-size" };
          target[key] = Array.isArray(value) ? [] : {};
          stack.push({ source: value, target: target[key], depth: depth + 1 });
        } else if (value !== undefined)
          return { ok: false, reason: "field-type" };
        if (bytes > config.maxBytes)
          return { ok: false, reason: "byte-budget" };
        if (mediaKeys.has(key)) {
          const mediaLength = Object.getOwnPropertyDescriptor(
            value || {},
            "fileLength",
          );
          if (mediaLength && !Object.hasOwn(mediaLength, "value"))
            return { ok: false, reason: "accessor" };
          const size = declaredMediaBytes(mediaLength?.value);
          if (size !== null && size > config.maxMedia)
            return { ok: false, reason: "media-size" };
          if (
            Object.getOwnPropertyDescriptor(value || {}, "width")?.value *
              Object.getOwnPropertyDescriptor(value || {}, "height")?.value >
            40000000
          )
            return { ok: false, reason: "media-dimensions" };
        }
      }
    }
    const key = root.key;
    if (
      !key ||
      typeof key.remoteJid !== "string" ||
      !/^[-\w.:]+@(g\.us|s\.whatsapp\.net|lid|broadcast|newsletter)$/.test(
        key.remoteJid,
      ) ||
      key.remoteJid.length > 160 ||
      typeof key.id !== "string" ||
      !key.id ||
      key.id.length > 160
    )
      return { ok: false, reason: "identity" };
    if (key.fromMe !== undefined && typeof key.fromMe !== "boolean")
      return { ok: false, reason: "identity" };
    const sender = key.fromMe
      ? "self"
      : key.remoteJid.endsWith("@g.us")
        ? key.participant || key.participantPn || key.participantAlt
        : key.remoteJid;
    if (
      typeof sender !== "string" ||
      sender.length > 160 ||
      (!key.fromMe && !/^[\w.:-]+@(s\.whatsapp\.net|lid)$/.test(sender))
    )
      return { ok: false, reason: "sender" };
    if (
      !root.message ||
      typeof root.message !== "object" ||
      Array.isArray(root.message)
    )
      return { ok: false, reason: "content" };
    let message = root.message;
    for (let i = 0; i < config.maxDepth; i++) {
      const wrapper = wrappers.find((k) => message[k]);
      if (!wrapper) break;
      message = message[wrapper]?.message;
      if (!message || typeof message !== "object" || Array.isArray(message))
        return { ok: false, reason: "wrapper" };
    }
    const supported = new Set([
      "conversation",
      "extendedTextMessage",
      ...mediaKeys,
      "buttonsResponseMessage",
      "templateButtonReplyMessage",
      "listResponseMessage",
      "interactiveResponseMessage",
      "pollUpdateMessage",
      "pollCreationMessage",
      "pollCreationMessageV2",
      "pollCreationMessageV3",
      "protocolMessage",
      "reactionMessage",
      "contactsArrayMessage",
      "contactMessage",
      "locationMessage",
      "liveLocationMessage",
      "groupInviteMessage",
      "eventMessage",
      "groupStatusMentionMessage",
      "botInvokeMessage",
      "pollState",
      "groupEvent",
      "call",
    ]);
    if (!Object.keys(message).some((key) => supported.has(key)))
      return { ok: false, reason: "unsupported-content" };
    if ("conversation" in message && typeof message.conversation !== "string")
      return { ok: false, reason: "text-type" };
    for (const name of ["extendedTextMessage", ...mediaKeys])
      if (
        name in message &&
        (!message[name] ||
          typeof message[name] !== "object" ||
          Array.isArray(message[name]))
      )
        return { ok: false, reason: "content-type" };
    for (const value of Object.values(message))
      if (value && typeof value === "object")
        for (const field of ["text", "caption"])
          if (value[field] != null && typeof value[field] !== "string")
            return { ok: false, reason: "text-type" };
    root.message = message;
    return {
      ok: true,
      message: root,
      chat: key.remoteJid,
      sender,
      id: key.id,
      bytes,
    };
  } catch {
    return { ok: false, reason: "validation-error" };
  }
}
class Buckets {
  constructor(cap, clock) {
    this.cap = cap;
    this.clock = clock;
    this.map = new Map();
  }
  take(key, burst, window) {
    const now = this.clock();
    let row = this.map.get(key);
    if (!row) {
      if (this.map.size >= this.cap) {
        for (const [id, value] of this.map)
          if (now - value.at > window * 2) this.map.delete(id);
        if (this.map.size >= this.cap) return false;
      }
      row = { tokens: burst, at: now };
      this.map.set(key, row);
    }
    row.tokens = Math.min(
      burst,
      row.tokens + ((now - row.at) * burst) / window,
    );
    row.at = now;
    if (row.tokens < 1) return false;
    row.tokens--;
    return true;
  }
}
export class IngestionDefense {
  constructor({
    config = defenseConfig(),
    clock = () => performance.now(),
    onDeadline = () => process.emit("alpha:fatal", "handler-deadline"),
    isQuarantined = () => false,
  } = {}) {
    this.config = config;
    this.clock = clock;
    this.onDeadline = onDeadline;
    this.isQuarantined = isQuarantined;
    this.buckets = new Buckets(config.stateCap, clock);
    this.seen = new Map();
    this.pending = [];
    this.activeChats = new Set();
    this.active = 0;
    this.stopped = false;
    this.counts = {
      accepted: 0,
      dropped: 0,
      duplicates: 0,
      failed: 0,
      timeouts: 0,
      completed: 0,
      latencyTotal: 0,
      latencyMax: 0,
    };
  }
  submit(raw, handler, { kind = "message" } = {}) {
    const memory = process.memoryUsage();
    if (
      this.stopped ||
      memory.heapUsed > this.config.heapWarnMb * 1048576 ||
      memory.rss > this.config.rssWarnMb * 1048576
    ) {
      this.counts.dropped++;
      return Promise.resolve(false);
    }
    const v = validateMessage(raw, this.config);
    if (!v.ok) {
      this.counts.dropped++;
      return Promise.resolve(false);
    }
    const c = this.config,
      now = this.clock(),
      fingerprint =
        kind === "poll-state"
          ? createHash("sha256")
              .update(
                JSON.stringify(v.message.message, (_k, x) =>
                  typeof x === "bigint" ? String(x) : x,
                ),
              )
              .digest("hex")
          : "",
      key = JSON.stringify([kind, v.chat, v.sender, v.id, fingerprint]);
    const quarantineHash = createHash("sha256").update(key).digest("hex");
    if (this.isQuarantined(quarantineHash)) {
      this.counts.dropped++;
      return Promise.resolve(false);
    }
    if ((this.seen.get(key) || 0) > now) {
      this.counts.duplicates++;
      return Promise.resolve(false);
    }
    const queuedForChat = this.pending.filter((x) => x.chat === v.chat).length;
    if (
      this.pending.length >= c.queue ||
      queuedForChat >= c.chatQueue ||
      !this.buckets.take("global", c.globalBurst, c.window) ||
      !this.buckets.take("chat:" + v.chat, c.chatBurst, c.window) ||
      !this.buckets.take(
        "sender:" + v.chat + ":" + v.sender,
        c.senderBurst,
        c.window,
      ) ||
      !this.buckets.take(
        "sender-global:" + v.sender,
        c.senderBurst * 2,
        c.window,
      )
    ) {
      this.counts.dropped++;
      return Promise.resolve(false);
    }
    if (this.seen.size >= c.stateCap) {
      for (const [id, until] of this.seen)
        if (until <= now) this.seen.delete(id);
      if (this.seen.size >= c.stateCap) {
        this.counts.dropped++;
        return Promise.resolve(false);
      }
    }
    this.seen.set(key, now + c.dedupMs);
    this.counts.accepted++;
    return new Promise((resolve) => {
      this.pending.push({
        chat: v.chat,
        message: v.message,
        handler,
        resolve,
        at: now,
        quarantineHash,
      });
      this.pump();
    });
  }
  pump() {
    while (!this.stopped && this.active < this.config.concurrency) {
      const i = this.pending.findIndex(
        (job) => !this.activeChats.has(job.chat),
      );
      if (i < 0) break;
      const job = this.pending.splice(i, 1)[0];
      if (this.clock() - job.at > this.config.queueTtl) {
        this.counts.dropped++;
        job.resolve(false);
        continue;
      }
      this.active++;
      this.activeChats.add(job.chat);
      const controller = new AbortController();
      const timer = setTimeout(() => {
        this.counts.timeouts++;
        controller.abort();
        this.stop();
        this.onDeadline(job.quarantineHash);
      }, this.config.deadline);
      timer.unref?.();
      Promise.resolve()
        .then(() => job.handler(job.message, controller.signal))
        .then(
          () => {
            this.counts.completed++;
            job.resolve(true);
          },
          () => {
            this.counts.failed++;
            job.resolve(false);
          },
        )
        .finally(() => {
          clearTimeout(timer);
          this.active--;
          this.activeChats.delete(job.chat);
          const latency = this.clock() - job.at;
          this.counts.latencyTotal += latency;
          this.counts.latencyMax = Math.max(this.counts.latencyMax, latency);
          this.pump();
        });
    }
  }
  stop() {
    this.stopped = true;
    for (const job of this.pending.splice(0)) job.resolve(false);
  }
  stats() {
    return {
      ...this.counts,
      active: this.active,
      queued: this.pending.length,
      identities: this.buckets.map.size,
      dedup: this.seen.size,
      stopped: this.stopped,
    };
  }
}
export const ingestionDefense = new IngestionDefense({
  isQuarantined: (hash) => messageQuarantine.has(hash),
  onDeadline: quarantineAndRestart,
});
