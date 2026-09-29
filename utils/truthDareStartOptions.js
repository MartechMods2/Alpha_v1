const THEMES = new Set(["classic", "funny", "deep", "friendship", "tech", "random"]);

export const parseTruthDareStart = (args = []) => {
  let rounds = 2;
  let theme = "classic";
  let lobbyMs = 30_000;
  for (const raw of args) {
    const value = String(raw || "").toLowerCase();
    if (/^[1-5]$/.test(value)) rounds = Number(value);
    else if (THEMES.has(value)) theme = value;
    else if (/^lobby=(?:[1-9]\d*)(?:s|m)$/.test(value)) {
      const match = /^lobby=(\d+)(s|m)$/.exec(value);
      const duration = Number(match[1]) * (match[2] === "m" ? 60_000 : 1_000);
      if (duration < 30_000 || duration > 10 * 60_000) {
        throw new Error("Lobby duration must be between 30 seconds and 10 minutes.");
      }
      lobbyMs = duration;
    } else if (value.startsWith("lobby=")) {
      throw new Error("Use lobby=90s or lobby=2m (30 seconds to 10 minutes).");
    }
  }
  return { rounds, theme, lobbyMs };
};
