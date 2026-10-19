export function createConnectionManager({
  create,
  attach,
  onSocket = () => {},
  random = Math.random,
  delay = setTimeout,
  cancel = clearTimeout,
  maxAttempts = 8,
} = {}) {
  let current = null,
    inFlight = null,
    timer = null,
    stableTimer = null,
    attempts = 0,
    stopped = false,
    generation = 0;
  function schedule() {
    if (stopped || timer) return;
    if (attempts >= maxAttempts) {
      stopped = true;
      return;
    }
    const ms = Math.min(60000, 1000 * 2 ** Math.min(attempts, 6));
    timer = delay(
      () => {
        timer = null;
        void start("retry");
      },
      Math.min(60000, Math.round(ms * (0.75 + random() * 0.5))),
    );
    timer?.unref?.();
  }
  function start(reason = "initial") {
    if (reason === "connection-open") {
      if (stableTimer) cancel(stableTimer);
      stableTimer = delay(() => {
        attempts = 0;
      }, 30000);
      stableTimer?.unref?.();
      return Promise.resolve(current);
    }
    if (reason === "session-stop") {
      if (timer) cancel(timer);
      timer = null;
      if (stableTimer) cancel(stableTimer);
      stableTimer = null;
      stopped = true;
      return Promise.resolve(null);
    }
    if (reason === "reconnect") {
      if (stableTimer) cancel(stableTimer);
      stableTimer = null;
      schedule();
      return Promise.resolve(null);
    }
    if (stopped && reason !== "manual-reconnect") return Promise.resolve(null);
    if (inFlight) return inFlight;
    if (reason === "manual-reconnect") {
      stopped = false;
      attempts = 0;
    }
    if (attempts >= maxAttempts) {
      stopped = true;
      return Promise.resolve(null);
    }
    if (timer) cancel(timer);
    timer = null;
    attempts++;
    const token = ++generation;
    const previous = current;
    current = null;
    try {
      previous?.end?.(undefined);
    } catch {}
    inFlight = Promise.resolve()
      .then(create)
      .then(async (sock) => {
        if (stopped || token !== generation) {
          sock?.end?.(undefined);
          return null;
        }
        current = sock;
        onSocket(sock);
        await attach(sock, (nextReason) =>
          token === generation ? start(nextReason) : Promise.resolve(null),
        );
        return sock;
      })
      .catch(() => {
        console.warn("[CONNECTION] Initialization failed.");
        schedule();
        return null;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }
  return {
    start,
    stop: () => {
      stopped = true;
      generation++;
      if (timer) cancel(timer);
      if (stableTimer) cancel(stableTimer);
      timer = stableTimer = null;
      try {
        current?.end?.(undefined);
      } catch {}
    },
    stats: () => ({
      attempts,
      connecting: Boolean(inFlight),
      scheduled: Boolean(timer),
      stopped,
    }),
  };
}
