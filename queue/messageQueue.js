const int = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : fallback;
};
export class MessageQueue {
  constructor() {
    this.queues = new Map();
    this.processing = new Map();
    this.lastSentAt = new Map();
    this.messageDelay = int(process.env.MESSAGE_DELAY_MS, 500, 250, 60000);
    this.groupMessageDelay = int(
      process.env.GROUP_MESSAGE_DELAY_MS,
      900,
      500,
      60000,
    );
    this.maxConcurrent = int(process.env.MAX_CONCURRENT_SENDS, 2, 1, 3);
    this.activeSends = 0;
    this.stopped = false;
    this.wake = null;
    this.maxQueue = int(process.env.ALPHA_SEND_QUEUE, 256, 16, 1024);
    this.chatCap = int(process.env.ALPHA_SEND_CHAT_QUEUE, 32, 2, 128);
    this.deadline = int(
      process.env.ALPHA_SEND_DEADLINE_MS,
      120000,
      1000,
      300000,
    );
    this.batchSize = 1;
    this.groupBatchDelay = this.groupMessageDelay;
    this.cleanupInterval = setInterval(() => this.cleanupEmptyQueues(), 300000);
    this.cleanupInterval.unref?.();
  }
  cleanupEmptyQueues() {
    for (const [chat, rows] of this.queues)
      if (!rows.length && !this.processing.get(chat)) {
        this.queues.delete(chat);
        this.processing.delete(chat);
      }
    for (const [chat, at] of this.lastSentAt)
      if (Date.now() - at > 3600000 && !this.queues.has(chat))
        this.lastSentAt.delete(chat);
  }
  enqueue(chatId, sendFunction, priority = 1) {
    if (
      this.stopped ||
      typeof chatId !== "string" ||
      typeof sendFunction !== "function" ||
      this.getStats().totalQueued >= this.maxQueue ||
      (this.queues.get(chatId)?.length || 0) >= this.chatCap
    ) {
      const denied = Promise.reject(Error("Outbound queue capacity reached"));
      denied.catch(() => {});
      return denied;
    }
    if (!this.queues.has(chatId)) this.queues.set(chatId, []);
    const completion = new Promise((resolve, reject) => {
      const rows = this.queues.get(chatId);
      rows.push({ sendFunction, priority, resolve, reject });
      rows.sort((a, b) => a.priority - b.priority);
    });
    // Expected overflow/send failures must not turn fire-and-forget legacy callers
    // into an unhandled-rejection restart loop. Awaiting callers still see errors.
    completion.catch(() => {});
    this.pump();
    return completion;
  }
  pump() {
    if (this.stopped) return;
    if (this.wake) {
      clearTimeout(this.wake);
      this.wake = null;
    }
    let wait = Infinity;
    while (this.activeSends < this.maxConcurrent) {
      let ready = null;
      wait = Infinity;
      for (const [chat, rows] of this.queues) {
        if (!rows.length || this.processing.get(chat)) continue;
        const spacing = chat.endsWith("@g.us")
          ? this.groupMessageDelay
          : this.messageDelay;
        const remaining =
          (this.lastSentAt.get(chat) || 0) + spacing - Date.now();
        if (remaining <= 0) {
          ready = chat;
          break;
        }
        wait = Math.min(wait, remaining);
      }
      if (!ready) break;
      const rows = this.queues.get(ready),
        job = rows.shift();
      this.queues.delete(ready);
      this.queues.set(ready, rows);
      this.processing.set(ready, true);
      this.activeSends++;
      const deadline = setTimeout(() => {
        this.stopped = true;
        for (const chat of this.queues.keys()) this.clearQueue(chat);
        process.emit("alpha:fatal", "send-deadline");
      }, this.deadline);
      deadline.unref?.();
      Promise.resolve()
        .then(job.sendFunction)
        .then(job.resolve, () => job.reject(Error("Outbound send failed")))
        .finally(() => {
          clearTimeout(deadline);
          this.lastSentAt.set(ready, Date.now());
          this.activeSends--;
          this.processing.set(ready, false);
          this.pump();
        });
    }
    if (Number.isFinite(wait) && this.activeSends < this.maxConcurrent) {
      this.wake = setTimeout(
        () => {
          this.wake = null;
          this.pump();
        },
        Math.max(1, wait),
      );
    }
  }
  // Kept for compatibility with runtime integrations.
  async processQueue() {
    this.pump();
  }
  getStats() {
    const stats = {
      totalQueued: 0,
      queuesByChat: {},
      activeSends: this.activeSends,
    };
    for (const [chat, rows] of this.queues) {
      stats.totalQueued += rows.length;
      stats.queuesByChat[chat] = rows.length;
    }
    return stats;
  }
  clearQueue(chat) {
    const rows = this.queues.get(chat) || [];
    for (const job of rows) job.reject(Error("Message queue was cleared"));
    rows.length = 0;
  }
  stop() {
    this.stopped = true;
    if (this.wake) clearTimeout(this.wake);
    clearInterval(this.cleanupInterval);
    for (const chat of this.queues.keys()) this.clearQueue(chat);
  }
}
const messageQueue = new MessageQueue();
export default messageQueue;
