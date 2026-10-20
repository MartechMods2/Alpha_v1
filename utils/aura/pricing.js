import { readFileSync } from "node:fs";
// Read once at startup, never on the message-processing hot path.
export const priceConfig = JSON.parse(
  readFileSync(
    new URL("../../config/aura-prices.json", import.meta.url),
    "utf8",
  ),
);
export function applyPrices(rows, section, identify, config = priceConfig) {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw Error("Aura prices must be a JSON object.");
  for (const key of Object.keys(config))
    if (!["shop", "bags", "evo", "commands"].includes(key))
      throw Error(`Unknown Aura price section: ${key}`);
  const prices = config[section] ?? {};
  if (!prices || typeof prices !== "object" || Array.isArray(prices))
    throw Error(`Aura prices.${section} must be an object.`);
  const allowed = new Set(rows.map((row) => String(identify(row))));
  for (const [id, value] of Object.entries(prices)) {
    if (!allowed.has(id))
      throw Error(`Unknown Aura price ID: ${section}.${id}`);
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > (section === "commands" ? 10000 : 10000000000)
    )
      throw Error(
        `Aura price ${section}.${id} must be a whole number from 1 to ${section === "commands" ? 10000 : 10000000000}.`,
      );
  }
  for (const row of rows) {
    const id = String(identify(row));
    if (Object.hasOwn(prices, id)) row.price = prices[id];
  }
  return rows;
}
