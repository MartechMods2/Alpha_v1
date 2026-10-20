import { createAuraChargeRunner } from "./charging.js";
import { auraIdentity } from "./identity.js";
export const runAuraCommand = createAuraChargeRunner({
  getEngine: async () => (await import("../../db/auraData.js")).aura,
  identify: auraIdentity,
});
