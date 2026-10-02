// Coalesce concurrent work only. Completed data is never cached here, so access
// checks and runtime state remain fresh on the next request.
export const createSingleFlight = () => {
  const pending = new Map();
  return (key, work) => {
    if (pending.has(key)) return pending.get(key);
    const result = Promise.resolve().then(work).finally(() => { if (pending.get(key) === result) pending.delete(key); });
    pending.set(key, result);
    return result;
  };
};
