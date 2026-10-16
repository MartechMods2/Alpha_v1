import { mentionIds } from "../../../utils/premiumReplies.js";
import { extractPhoneNumber } from "../../../utils/lid.js";
const handler = async (sock, msg, from, args, info) => {
  const metadata = await sock.groupMetadata(from);
  const mentions = mentionIds(metadata);
  const list = args[0] === "list";
  const text =
    args
      .slice(list ? 1 : 0)
      .join(" ")
      .trim() || "A message for everyone";
  if (!mentions.length)
    return info.sendMessageWTyping(
      from,
      { text: "No mentionable group members were returned." },
      { quoted: msg },
    );
  return info.sendMessageWTyping(
    from,
    {
      text: `📣 *GROUP NOTICE*\n\n${text}\n\n${list ? mentions.map((j) => "@" + extractPhoneNumber(j)).join("\n") : `_${mentions.length} members mentioned_`}`,
      mentions,
    },
    { quoted: msg },
  );
};
export default () => ({
  cmd: ["tagall"],
  desc: "Mention every member compactly; use list for visible mentions",
  usage: "tagall <message> | tagall list <message>",
  handler,
});
