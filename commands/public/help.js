import { profileMessage } from "../../utils/profileMessage.js";
import { cmdToText } from "../../utils/commandLoader.js";
import { searchCommands } from "../../utils/commandSearch.js";
import {
  visibleCommandSections,
  menuOverview,
  commandPage,
} from "../../utils/botMenu.js";

const handler = async (sock, msg, from, args, info) => {
  const prefix = info.prefix || process.env.PREFIX || "$";
  const reply = (text) =>
    info.sendMessageWTyping(from, { text }, { quoted: msg });
  const sections = visibleCommandSections(await cmdToText(), info);
  const all = Object.values(sections).flat();
  const section = String(args[0] || "").toLowerCase();
  if (!section || section === "categories")
    return info.sendMessageWTyping(
      from,
      await profileMessage(
        sock,
        sock.user?.id || sock.user?.lid,
        menuOverview(sections, prefix),
      ),
      { quoted: msg },
    );
  if (["all", "public", "group", "admin", "owner"].includes(section)) {
    if (section !== "all" && !sections[section])
      return reply(
        "This category is available only to authorized administrators or the owner.",
      );
    return reply(
      commandPage(section === "all" ? all : sections[section], {
        prefix,
        page: args[1] || 1,
        title:
          section === "all"
            ? "Command catalogue"
            : section[0].toUpperCase() + section.slice(1) + " commands",
        route: "menu " + section,
      }),
    );
  }
  let query = (section === "search" ? args.slice(1).join(" ") : args.join(" "))
    .trim()
    .toLowerCase();
  if (query.startsWith(prefix)) query = query.slice(prefix.length);
  query = query.replace(/^[-/]/, "");
  if (!query)
    return reply(
      `Use ${prefix}help search <task>, for example ${prefix}help search stickers.`,
    );
  const found = all.find((entry) => entry.cmd.includes(query));
  if (!found) {
    const matches = searchCommands(all, query, 8);
    return reply(
      matches.length
        ? `*COMMAND SEARCH*\n\n${matches.map((entry) => `• ${prefix}${entry.cmd[0]} — ${entry.desc}`).join("\n")}\n\nDetails: ${prefix}help <command>`
        : `No available command matched. Try ${prefix}menu categories or ${prefix}help search <task>.`,
    );
  }
  return reply(
    `*${prefix}${found.cmd[0]}*\n\n${found.desc}\n\n*Usage:* ${prefix}${found.usage || found.cmd[0]}${
      found.cmd.length > 1
        ? "\n*Aliases:* " +
          found.cmd
            .slice(1)
            .map((x) => prefix + x)
            .join(", ")
        : ""
    }\n\nCommands still follow chat permissions, quotas and feature settings.`,
  );
};
export default () => ({
  cmd: ["help", "menu"],
  desc: "Safe bot overview, paged command catalogue, usage and command search",
  usage:
    "menu | menu all [page] | menu public [page] | help <command> | help search <task>",
  handler,
});
