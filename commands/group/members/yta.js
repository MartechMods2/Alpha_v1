import songCommand from "./song.js";
import { isYouTubeUrl } from "../../../utils/ytdlp.js";
const shared = songCommand();
export default () => ({
  cmd: ["yta"],
  desc: "Download YouTube audio through Alpha's bounded audio pipeline",
  usage: "yta <YouTube link> [--voice]",
  handler: async (sock, msg, from, args, info) => {
    if (!isYouTubeUrl(args[0]) || args.length > 2 || (args[1] && args[1] !== "--voice"))
      return info.sendMessageWTyping(from, { text: "❌ Use yta <YouTube link> [--voice]." }, { quoted: msg });
    return shared.handler(sock, msg, from, args, info);
  },
});
