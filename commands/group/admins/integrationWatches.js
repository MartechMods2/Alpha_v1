import {
  safePackItems,
  createSafeItem,
  listSafeItems,
  removeSafeItem,
} from "../../../db/safePackData.js";
import { publicRequest, publicRepo } from "../../../utils/featureHttp.js";
import { load } from "cheerio";
const handler = async (sock, msg, from, args, info) => {
  const reply = (text) =>
      info.sendMessageWTyping(from, { text }, { quoted: msg }),
    type = {
      feed: "rss-watch",
      monitor: "uptime-watch",
      githubwatch: "github-watch",
    }[info.command],
    action = args[0] || "list";
  if (!(info.isOwner || info.isGroupAdmin) || !info.isGroup)
    return reply("Group administrators only.");
  if (action === "list") {
    const rows = await listSafeItems(from, type, {}, 10);
    return reply(
      rows.map((x) => `${x._id} • ${x.text}`).join("\n") ||
        "No watches. Add one with " + info.command + " add <target>.",
    );
  }
  if (action === "remove") {
    await removeSafeItem(from, type, args[1]);
    return reply("Watch removed if it existed in this group.");
  }
  if (action !== "add") return reply("Actions: add, list, remove.");
  if (
    (await safePackItems.countDocuments({
      type: { $in: ["rss-watch", "uptime-watch", "github-watch"] },
      status: "active",
    })) >= 100
  )
    return reply(
      "Watch capacity reached (100 total). Remove an unused watch first.",
    );
  if ((await listSafeItems(from, type, {}, 10)).length >= 3)
    return reply("Limit: 3 watches of this kind per group.");
  let target = args[1];
  if (type === "github-watch") target = publicRepo(target);
  else if (type === "rss-watch") {
    const response = await publicRequest(target, { maxBytes: 1024 * 1024 });
    const feed = load(response.buffer.toString(), { xmlMode: true });
    if (response.status !== 200 || !feed("rss,feed,RDF").length)
      return reply("Use a readable public RSS or Atom feed URL.");
  } else await publicRequest(target, { method: "HEAD", maxBytes: 1024 });
  const item = await createSafeItem({
    groupJid: from,
    type,
    memberJid: info.senderJid,
    text: target,
    payload: {},
    status: "active",
  });
  return reply(
    `Watch created: ${item._id}\nChecks run every 15 minutes while Alpha is connected. Only changes produce a notification. RSS content is capped to 3 updates per check.`,
  );
};
export default () => ({
  cmd: ["feed", "monitor", "githubwatch"],
  desc: "Bounded RSS feeds, website availability and GitHub release watches",
  usage:
    "feed add <https URL> | monitor add <https URL> | githubwatch add owner/repo | monitor list",
  handler,
});
