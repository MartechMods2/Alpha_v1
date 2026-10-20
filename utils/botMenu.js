const clean = (value, max = 700) =>
  String(value || "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .slice(0, max);
export function visibleCommandSections(catalogue, info = {}) {
  const sections = {
    public: catalogue.publicCommands || [],
    group: catalogue.groupCommands || [],
  };
  if (info.isOwner || info.isModerator || (info.isGroup && info.isGroupAdmin))
    sections.admin = catalogue.adminCommands || [];
  if (info.isOwner || info.isModerator)
    sections.owner = catalogue.ownerCommands || [];
  // Only public help fields are returned; never source paths or runtime configuration.
  return Object.fromEntries(
    Object.entries(sections).map(([key, rows]) => [
      key,
      rows
        .map((row) => ({
          cmd: (row.cmd || []).filter((x) => typeof x === "string"),
          desc: clean(row.desc),
          usage: clean(row.usage),
        }))
        .filter((row) => row.cmd.length),
    ]),
  );
}
export function menuOverview(sections, prefix = "$") {
  const count = Object.values(sections).flat().length;
  return `╭─ ✦ *ALPHA* ✦\n╰─ YOUR COMMUNITY ASSISTANT\nCreated and maintained by *Martech*\n\n┌─ ✧ *BUILT FOR YOUR COMMUNITY*\n• AI conversations and useful everyday tools\n• Stickers, media and creative cards\n• Games, quizzes and group activities\n• Welcome cards, mentions and moderation\n• Learning, productivity and defensive security\n• Opt-in community notifications and integrations\n\n┌─ ✧ *EXPLORE · ${count} COMMAND ENTRIES*\n${Object.entries(
    sections,
  )
    .map(([name, rows]) => `• ${prefix}menu ${name} — ${rows.length} entries`)
    .join(
      "\n",
    )}\n\n┌─ ✧ *QUICK NAVIGATION*\n• ${prefix}menu all — paged catalogue with usage\n• ${prefix}help <command> — description and aliases\n• ${prefix}help search <task> — search by purpose\n\n┌─ ✧ *START HERE*\n${prefix}help everyone\n${prefix}help ban\n${prefix}worldclock Africa/Lagos\n${prefix}2048 start\n\n*Prefix:* ${prefix}\nGroup tools require a group; moderation requires suitable admin permissions. Some services need owner setup or have quotas. Command visibility does not bypass permissions or disabled features.\n\nI never display owner contact details, credentials, account IDs or internal diagnostics in this menu.`;
}
export function commandPage(
  rows,
  {
    title = "Commands",
    prefix = "$",
    page = 1,
    route = "menu all",
    limit = 3400,
  } = {},
) {
  const pages = [];
  let current = "";
  for (const entry of rows) {
    const block = `✦ *${prefix}${entry.cmd[0]}*\n${clean(entry.desc, 400)}\nUsage: ${prefix}${clean(entry.usage || entry.cmd[0], 600)}\n`;
    if (current && current.length + block.length > limit) {
      pages.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + block;
  }
  if (current || !pages.length)
    pages.push(current || "No commands available in this category.");
  const requested = /^\d+$/.test(String(page)) ? Number(page) : 0;
  if (
    !Number.isSafeInteger(requested) ||
    requested < 1 ||
    requested > pages.length
  )
    return `Choose page 1–${pages.length}: ${prefix}${route} <page>.`;
  return `*${title} • ${requested}/${pages.length}*\n\n${pages[requested - 1]}\n${requested < pages.length ? `Next: ${prefix}${route} ${requested + 1}\n` : ""}Details: ${prefix}help <command>`;
}
