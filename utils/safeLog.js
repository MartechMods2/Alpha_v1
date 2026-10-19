export function safeLogParts(parts, env = process.env) {
  const secrets = Object.entries(env)
    .filter(
      ([key, value]) =>
        /KEY|TOKEN|SECRET|PASSWORD|MONGODB|SESSION/i.test(key) &&
        typeof value === "string" &&
        value.length >= 8,
    )
    .map(([, value]) => value);
  return parts.slice(0, 6).map((part, index) => {
    if (
      index > 0 &&
      typeof part === "string" &&
      !/^[A-Z][A-Z0-9_:-]{1,60}$/.test(part)
    )
      return "[details suppressed]";
    if (part instanceof Error) return "[error details suppressed]";
    if (part !== null && typeof part === "object")
      return "[structured data suppressed]";
    let text = String(part ?? "");
    for (const secret of secrets) text = text.split(secret).join("[redacted]");
    return text
      .slice(0, 1000)
      .replace(
        /\b(?:https?|mongodb(?:\+srv)?):\/\/[^\s]+/gi,
        "[URL suppressed]",
      )
      .replace(
        /[\w.:-]+@(?:s\.whatsapp\.net|g\.us|lid|broadcast|newsletter)/gi,
        "[chat]",
      )
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
      .replace(/\b\+?\d{8,}\b/g, "[identifier]");
  });
}
