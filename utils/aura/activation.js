import { AuraUserError } from "./errors.js";
// Explicit persistent opt-in. A missing setting is OFF; no truthy-string coercion.
export const isAuraEnabled = async (store) =>
  (await store.get("AuraSettings", "economy"))?.enabled === true;
export async function setAuraEnabled(store, enabled, actor, isCreator) {
  if (!isCreator(actor))
    throw new AuraUserError(
      "Only the primary configured creator can activate or disable Aura.",
    );
  if (typeof enabled !== "boolean")
    throw new AuraUserError("Choose on or off.");
  return store.transaction(async (tx) => {
    const row = {
      _id: "economy",
      enabled,
      updatedAt: new Date(),
      updatedBy: actor,
    };
    await tx.put("AuraSettings", row);
    return enabled;
  });
}
