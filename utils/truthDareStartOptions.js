const THEMES = new Set(["classic", "funny", "deep", "friendship", "tech", "random"]);
import { parseHostedOptions } from "./hostedGameOptions.js";

export const parseTruthDareStart = (args = []) => {
  const { rounds, lobbyMs, rest } = parseHostedOptions(args);
  const theme = rest.filter(value => THEMES.has(value)).at(-1) || "classic";
  return { rounds, theme, lobbyMs };
};
