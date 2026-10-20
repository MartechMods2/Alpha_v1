import { isAuraEnabled } from "./activation.js";
import { createAuraChargeRunner } from "./charging.js";
import { auraIdentity } from "./identity.js";
export const runAuraCommand = createAuraChargeRunner({
  getEngine: async () => (await import("../../db/auraData.js")).aura,
  identify: auraIdentity,
  isEnabled: async () =>
    isAuraEnabled((await import("../../db/auraData.js")).auraStore),
});
