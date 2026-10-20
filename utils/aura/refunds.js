export function salvageRefund(wallet, product, isCreator = false) {
  if (isCreator) return 0;
  const saved = wallet.purchaseCosts?.[product.id];
  const paid = product.kind === "tool" ? saved?.[0] : saved;
  // Legacy purchases use conservative original catalogue prices.
  const basis = paid ?? product.basePrice;
  return Math.floor(Math.min(product.price, basis) * 0.25);
}
