// Decoration stays in headings: commands, URLs, numbers and body text remain readable.
export function premiumReply(text) {
  const value = String(text || "");
  if (
    !value ||
    value.startsWith("╭─ ✦") ||
    value.includes("```") ||
    value.length > 12000
  )
    return value;
  const lines = value.split("\n");
  // AI providers may already prepend a decorative brand-only line.
  // Remove only leading labels; preserve mentions of Alpha in real sentences.
  while (
    lines.length > 1 &&
    /^[^\p{L}\p{N}]*alpha[^\p{L}\p{N}]*$/iu.test(lines[0].trim())
  ) {
    lines.shift();
    while (lines[0]?.trim() === "") lines.shift();
  }
  const body = lines.join("\n").trim();
  if (!body || lines[0]?.length > 100 || /^https?:|^[{[]/.test(lines[0]))
    return body || value;
  return `╭─ ✦ *ALPHA* ✦\n│\n${body}\n│\n╰────────────────`;
}
export const normalizeWords = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export function containsBannedPhrase(body, phrase) {
  const text = normalizeWords(body),
    term = normalizeWords(phrase);
  if (!term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`,
    "u",
  ).test(text);
}
export function mentionIds(metadata) {
  return [
    ...new Set(
      (metadata?.participants || [])
        .map((p) =>
          typeof p === "string" ? p : p.id || p.jid || p.lid || p.phoneNumber,
        )
        .filter(
          (j) => typeof j === "string" && /@(s\.whatsapp\.net|lid)$/.test(j),
        ),
    ),
  ];
}
