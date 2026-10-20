import { AuraUserError } from "./errors.js";
import { applyPrices } from "./pricing.js";
export const BAG_TIERS = [
  { slots: 20, price: 0 },
  { slots: 24, price: 120000 },
  { slots: 40, price: 250000 },
  { slots: 64, price: 500000 },
  { slots: 128, price: 2000000 },
  { slots: 10000, price: 75000000, evo: 5 },
  { slots: 9999999, price: 5000000000, evo: 6 },
];
applyPrices(BAG_TIERS.slice(1), "bags", (row) => row.slots);
export const inventoryUsed = (w) =>
  new Set(w.inventory || []).size +
  Object.values(w.items || {}).reduce(
    (n, q) => n + Math.max(0, Number(q) || 0),
    0,
  );
export function inventoryStatus(w) {
  const used = inventoryUsed(w),
    capacity = Math.max(
      20,
      w.inventoryFloor ?? Math.max(20, used),
      w.bagSlots || 20,
    );
  const next = BAG_TIERS.find((t) => t.slots > capacity);
  return { used, capacity, free: Math.max(0, capacity - used), next };
}
export function initialiseInventory(w) {
  // Preserve pre-limit inventories once; new acquisitions cannot raise the floor.
  if (!Number.isSafeInteger(w.inventoryFloor))
    w.inventoryFloor = Math.max(20, inventoryUsed(w));
}
export function requireInventorySpace(w) {
  const bag = inventoryStatus(w);
  if (bag.used >= bag.capacity)
    throw new AuraUserError(
      `Inventory full (${bag.used}/${bag.capacity}). Use $aurabag to expand, consume a tool or $aurasalvage an item.`,
    );
}
