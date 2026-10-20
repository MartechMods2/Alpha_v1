// Display-only names never participate in permissions or identity resolution.
export function cleanAuraName(value) {
  if (typeof value !== "string") return "";
  return [...value.slice(0, 512).normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/[*_~`<>@]/g, "")
    .replace(/\s+/g, " ").trim()].slice(0, 40).join("");
}
export function auraDisplayName(wallet = {}, info = {}, msg = {}) {
  return cleanAuraName(wallet.nickname) || cleanAuraName(info.updateName) ||
    cleanAuraName(info.senderName) || cleanAuraName(msg.pushName) || "Alpha member";
}
export const escapeAuraSvg = (value) => String(value).replace(/[&<>"']/g,
  (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);
