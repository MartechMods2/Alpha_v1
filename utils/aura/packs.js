import { AuraUserError } from "./errors.js";
import { SHOP, EVO } from "./policy.js";
import { applyPrices } from "./pricing.js";
import { inventoryStatus } from "./inventory.js";

// Packs are separate from individual stock: no accidental item gifting or salvage.
export const PACKS = [
  { id: "infinity", name: "Infinity Pack", price: 9999999, evo: 6, slots: 9999999, maxItemEvo: 6 },
  { id: "legendary-pro-plus", name: "Legendary Pro+ Pack", price: 5999999, evo: 6, slots: 10000, maxItemEvo: 6 },
  { id: "pro", name: "Pro Pack", price: 1999999, evo: 4, slots: 128, maxItemEvo: 0 },
];
applyPrices(PACKS, "packs", (row) => row.id);
PACKS.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
export const packStock = (pack) => SHOP.filter((item) => (item.evo || 0) <= pack.maxItemEvo);

export function grantPack(wallet, pack) {
  wallet.packs ||= [];
  if (wallet.packs.includes(pack.id))
    throw new AuraUserError("This one-time pack is already owned. Tools do not refill on repeat purchases.");
  wallet.inventory ||= [];
  wallet.items ||= {};
  wallet.purchaseCosts ||= {};
  wallet.badges ||= [];
  wallet.bagSlots = Math.max(wallet.bagSlots || 20, pack.slots);
  let added = 0;
  for (const item of packStock(pack)) {
    if (item.kind === "tool") {
      const count = wallet.items[item.id] || 0;
      const extra = Math.max(0, item.max - count);
      if (!extra) continue;
      // Preserve paid units' basis; new bundled units cannot mint salvage Aura.
      wallet.purchaseCosts[item.id] ||= Array(count).fill(item.basePrice);
      wallet.purchaseCosts[item.id].push(...Array(extra).fill(0));
      wallet.items[item.id] = count + extra;
      added += extra;
    } else if (!wallet.inventory.includes(item.id)) {
      wallet.inventory.push(item.id);
      wallet.purchaseCosts[item.id] = 0;
      added++;
    }
  }
  const stage = Math.max(wallet.evo || 0, pack.evo);
  wallet.evo = stage;
  if (EVO[stage].frame) {
    wallet.equipped = EVO[stage].frame;
    wallet.prestigeTitle = EVO[stage].title;
  }
  // Prestige badges describe the purchased entitlement, not earned XP or RP.
  for (let i = 1; i <= stage; i++)
    if (!wallet.badges.includes("Evo " + EVO[i].name))
      wallet.badges.push("Evo " + EVO[i].name);
  if (inventoryStatus(wallet).used > inventoryStatus(wallet).capacity)
    throw new AuraUserError("Pack cannot fit safely in this inventory. Contact the owner.");
  wallet.packs.push(pack.id);
  return { pack: pack.name, added, stage: EVO[stage].name, slots: inventoryStatus(wallet).capacity };
}
