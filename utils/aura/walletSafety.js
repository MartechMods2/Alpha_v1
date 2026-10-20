import { AuraUserError } from "./errors.js";
export const AURA_WALLET_CAP = 1e12;
export function assertAuraWallet(wallet) {
  const held = wallet.heldAura ?? 0;
  if (
    !Number.isSafeInteger(wallet.balance) ||
    wallet.balance < 0 ||
    !Number.isSafeInteger(held) ||
    held < 0 ||
    wallet.balance + held > AURA_WALLET_CAP
  )
    throw new AuraUserError(
      "Aura wallet safety limit exceeded (including reserved fees).",
    );
}
export const isUnexpired = (value, now = new Date()) => {
  const expires = +new Date(value);
  return Number.isFinite(expires) && expires > +now;
};
