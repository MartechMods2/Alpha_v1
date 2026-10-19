export function createControlledShutdown({
  begin,
  closeSockets,
  flush,
  closeServer,
  exit = (code) => process.exit(code),
  timeoutMs = 10000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let shutdown = null;
  let started = false;
  return function stop(exitCode = 0) {
    if (started) return shutdown || Promise.resolve(1);
    started = true;
    shutdown = (async () => {
      let failed = false;
      try {
        begin();
      } catch {
        failed = true;
      }
      // Start persistence before closing transport, but do not skip cleanup on failure.
      const persisted = Promise.resolve().then(flush);
      try {
        closeSockets();
      } catch {
        failed = true;
      }
      let timer;
      const deadline = new Promise((resolve) => {
        timer = setTimer(() => resolve("timeout"), timeoutMs);
      });
      const cleanup = Promise.allSettled([
        persisted,
        Promise.resolve().then(closeServer),
      ]);
      const result = await Promise.race([cleanup, deadline]);
      clearTimer(timer);
      const code =
        result === "timeout" ||
        failed ||
        result.some((row) => row.status === "rejected")
          ? 1
          : exitCode;
      exit(code);
      return code;
    })();
    return shutdown;
  };
}
