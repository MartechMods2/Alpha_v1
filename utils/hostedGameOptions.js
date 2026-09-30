export const MAX_HOSTED_ROUNDS = 100;
export const parseHostedOptions = (args, { rounds = 2, lobbyMs = 30_000 } = {}) => {
  const rest = [];
  for (const raw of args || []) {
    const value = String(raw || "").toLowerCase();
    if (/^(?:rounds=)?\d+$/.test(value)) {
      const count = Number(value.replace(/^rounds=/, ""));
      if (!Number.isSafeInteger(count) || count < 1 || count > MAX_HOSTED_ROUNDS) {
        throw new Error(`Choose 1–${MAX_HOSTED_ROUNDS} rounds.`);
      }
      rounds = count;
    } else if (value.startsWith("rounds=")) {
      throw new Error(`Choose 1–${MAX_HOSTED_ROUNDS} rounds, e.g. rounds=10.`);
    } else if (value.startsWith("lobby=")) {
      const match = /^lobby=(\d+)(s|m)$/.exec(value);
      if (!match) throw new Error("Use lobby=90s or lobby=2m (30 seconds to 10 minutes).");
      const duration = Number(match[1]) * (match[2] === "m" ? 60_000 : 1_000);
      if (duration < 30_000 || duration > 600_000) throw new Error("Lobby duration must be between 30 seconds and 10 minutes.");
      lobbyMs = duration;
    } else rest.push(value);
  }
  return { rounds, lobbyMs, rest };
};
