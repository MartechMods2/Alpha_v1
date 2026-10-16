export function validMembershipPayment(transaction, order) {
  return Boolean(
    transaction &&
      order &&
      transaction.status === "success" &&
      transaction.domain === "live" &&
      transaction.currency === "NGN" &&
      transaction.amount === order.amountKobo &&
      transaction.reference === order._id &&
      String(transaction.metadata?.alpha_member) === order.memberJid &&
      transaction.metadata?.alpha_group === order.groupJid &&
      transaction.metadata?.alpha_product === "group-membership" &&
      Number.isSafeInteger(transaction.id),
  );
}
