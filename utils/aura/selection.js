// Never silently choose among multiple financial recipients or products.
export function selectedRecipient(info) {
  const mentions = info.extendedMessageOriginal?.mentionedJid;
  if (mentions != null && !Array.isArray(mentions))
    throw Error("Mention one member or reply to their message.");
  if (mentions?.length > 1)
    throw Error("Choose only one recipient per transfer or gift.");
  const jid = mentions?.[0] || info.extendedMessageOriginal?.participant;
  if (typeof jid !== "string" || !jid)
    throw Error("Mention one member or reply to their message.");
  return jid;
}
export function selectedAmount(args) {
  const amounts = args.filter((x) => /^\d+$/.test(x));
  if (amounts.length !== 1)
    throw Error("Provide exactly one whole positive amount.");
  return amounts[0];
}
export function selectedItem(args, shop) {
  const items = args.filter((id) => shop.some((item) => item.id === id));
  if (items.length !== 1)
    throw Error("Choose exactly one owned shop item ID per gift.");
  return shop.find((item) => item.id === items[0]);
}
