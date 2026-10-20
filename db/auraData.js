import mdClient from "./client.js";
import { createAuraEngine } from "../utils/aura/engine.js";
import { createAuraMongoStore } from "../utils/aura/mongoStore.js";
export const auraStore = createAuraMongoStore(mdClient);
export const auraOwner = () => {
  const number = String(process.env.MY_NUMBER || "")
    .split(",")[0]
    .trim()
    .replace(/[+\s()-]/g, "");
  return /^\d{7,15}$/.test(number) ? `${number}@s.whatsapp.net` : "";
};
export const aura = createAuraEngine(auraStore, { owner: auraOwner });
