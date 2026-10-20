import { downloadResolvedMedia } from "../../../utils/mediaInput.js";
import { removeImageBackground } from "../../../utils/mediaStudio.js";
import { runMediaJob } from "../../../utils/mediaJobs.js";
const handler = async (sock, msg, from, _args, info) => {
  try {
    const { buffer } = await downloadResolvedMedia(sock, msg, {
      allowedKinds: ["image"],
      maxBytes: 10 * 1048576,
    });
    const image = await runMediaJob({
      feature: "removebg",
      groupJid: from,
      senderJid: info.senderJid,
      task: () => removeImageBackground(buffer),
    });
    return info.sendMessageWTyping(
      from,
      { image, mimetype: "image/png", caption: "Created by Alpha — Martech" },
      { quoted: msg },
    );
  } catch {
    return info.sendMessageWTyping(
      from,
      {
        text: "❌ Background removal failed. Reply to a supported image and check whether the provider is configured.",
      },
      { quoted: msg },
    );
  }
};
export default () => ({
  cmd: ["removebg", "bg"],
  desc: "Remove an image background with bounded provider processing",
  usage: "removebg --confirm (reply to image)",
  handler,
});
