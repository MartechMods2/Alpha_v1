import { featureJSON, publicRequest } from "../../utils/featureHttp.js";
import { downloadResolvedMedia } from "../../utils/mediaInput.js";
import {
  imageBufferToSticker,
  getFfmpegPath,
} from "../../utils/mediaStudio.js";
import { runMediaJob } from "../../utils/mediaJobs.js";
import { withTempFiles } from "../../utils/documentStudio.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile } from "node:fs/promises";
const exec = promisify(execFile),
  q = encodeURIComponent;
const handler = async (sock, msg, from, args, info) => {
  const send = (payload) =>
    info.sendMessageWTyping(from, payload, { quoted: msg });
  const command = info.command;
  try {
    return await runMediaJob({
      feature: command,
      groupJid: from,
      senderJid: info.senderJid,
      task: async () => {
        if (command === "shazam") {
          if (!process.env.AUDD_API_TOKEN)
            throw Error("Song recognition requires AUDD_API_TOKEN.");
          const media = await downloadResolvedMedia(sock, msg, {
            allowedKinds: ["audio", "video"],
            maxBytes: 8 * 1024 * 1024,
          });
          const body = new URLSearchParams({
            api_token: process.env.AUDD_API_TOKEN,
            audio: media.buffer.toString("base64"),
          }).toString();
          const x = await featureJSON("https://api.audd.io/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
            maxBytes: 1000000,
          });
          if (x.status !== "success")
            throw Error("Recognition service could not process this clip.");
          return send({
            text: x.result
              ? `${x.result.title} — ${x.result.artist}\n${x.result.album || ""}\n${x.result.song_link || ""}`
              : "No song matched. Try a clearer short clip.",
          });
        }
        if (command === "emojimix") {
          if (!process.env.TENOR_API_KEY)
            throw Error("Emoji mixing requires TENOR_API_KEY.");
          const [a, b] = args.join("").split("+");
          if (!a || !b || a.length > 12 || b.length > 12)
            throw Error("Usage: emojimix 😂+🔥");
          const data = await featureJSON(
            `https://tenor.googleapis.com/v2/featured?key=${q(process.env.TENOR_API_KEY)}&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${q(a + "_" + b)}`,
          );
          const url =
            data.results?.[0]?.media_formats?.png_transparent?.url ||
            data.results?.[0]?.url;
          if (!url)
            return send({ text: "This emoji combination is not available." });
          const r = await publicRequest(url, { maxBytes: 3 * 1024 * 1024 });
          return send({
            sticker: await imageBufferToSticker(r.buffer, {
              pack: "Alpha Emoji Kitchen",
              author: "Martech",
            }),
          });
        }
        if (command === "screenshot") {
          const url = new URL(args[0]);
          await publicRequest(url.href, { method: "HEAD", maxBytes: 1024 });
          const r = await publicRequest(
            `https://image.thum.io/get/width/1000/crop/1500/noanimate/${url.href}`,
            { maxBytes: 5 * 1024 * 1024 },
          );
          if (
            r.status !== 200 ||
            !String(r.headers["content-type"]).startsWith("image/")
          )
            throw Error("Screenshot service unavailable.");
          return send({
            image: r.buffer,
            caption: "Public webpage preview • " + url.hostname,
          });
        }
        if (command === "stickerimport") {
          const match = String(args[0] || "").match(
            /^https:\/\/t\.me\/addstickers\/([\w]{1,64})$/,
          );
          if (!match)
            throw Error("Use stickerimport https://t.me/addstickers/PACK_NAME");
          const token = process.env.TELEGRAM_STICKER_BOT_TOKEN;
          if (!token)
            throw Error("Sticker import requires TELEGRAM_STICKER_BOT_TOKEN.");
          const pack = await featureJSON(
            `https://api.telegram.org/bot${token}/getStickerSet?name=${q(match[1])}`,
          );
          if (!pack.ok) throw Error("Sticker pack not found.");
          const index = Math.max(1, Math.min(100, Number(args[1]) || 1));
          const item = pack.result.stickers[index - 1];
          if (!item) throw Error("Choose a sticker number in this pack.");
          if (item.is_video || item.is_animated)
            throw Error("This importer supports static WebP stickers only.");
          const file = await featureJSON(
            `https://api.telegram.org/bot${token}/getFile?file_id=${q(item.file_id)}`,
          );
          const r = await publicRequest(
            `https://api.telegram.org/file/bot${token}/${file.result.file_path}`,
            { maxBytes: 1024 * 1024 },
          );
          if (item.is_video || item.is_animated)
            throw Error("This importer supports static WebP stickers only.");
          return send({ sticker: r.buffer });
        }
        if (command === "audioeffect") {
          const filters = {
            bass: "bass=g=8",
            pitch: "asetrate=48000*1.1,aresample=48000",
            slow: "atempo=0.8",
            fast: "atempo=1.2",
            reverse: "areverse",
            echo: "aecho=0.8:0.88:60:0.3",
          };
          const filter = filters[args[0]];
          if (!filter)
            throw Error(
              "Effects: bass, pitch, slow, fast, reverse, echo. Reply to audio.",
            );
          const media = await downloadResolvedMedia(sock, msg, {
            allowedKinds: ["audio"],
            maxBytes: 8 * 1024 * 1024,
          });
          return withTempFiles([".bin", ".mp3"], async ([input, output]) => {
            await writeFile(input, media.buffer);
            await exec(
              getFfmpegPath(),
              [
                "-y",
                "-i",
                input,
                "-t",
                "60",
                "-af",
                filter,
                "-b:a",
                "128k",
                output,
              ],
              { timeout: 20000, maxBuffer: 128000 },
            );
            return send({
              audio: await readFile(output),
              mimetype: "audio/mpeg",
            });
          });
        }
        if (command === "drivefolder") {
          const match = String(args[0] || "").match(
            /^https:\/\/drive\.google\.com\/drive\/folders\/([\w-]{10,100})/,
          );
          if (!match) throw Error("Use a public Google Drive folder link.");
          const r = await publicRequest(
            `https://drive.google.com/drive/folders/${match[1]}`,
            { maxBytes: 2 * 1024 * 1024 },
          );
          const html = r.buffer.toString();
          const ids = [
            ...new Set(
              [...html.matchAll(/\/file\/d\/([\w-]{10,100})/g)].map(
                (x) => x[1],
              ),
            ),
          ].slice(0, 20);
          return send({
            text: ids.length
              ? ids
                  .map(
                    (id, i) =>
                      `${i + 1}. https://drive.google.com/file/d/${id}/view`,
                  )
                  .join("\n")
              : "No public file links were readable. This folder may require permission or dynamic loading. Alpha does not request access.",
          });
        }
      },
    });
  } catch (error) {
    return send({
      text: /requires|Usage:|Use |Effects:|supports|Choose|not available|not found|could not process/.test(
        error.message,
      )
        ? error.message
        : "Media request failed or timed out. Try a smaller file or retry later.",
    });
  }
};
export default () => ({
  cmd: [
    "shazam",
    "emojimix",
    "screenshot",
    "stickerimport",
    "audioeffect",
    "drivefolder",
  ],
  desc: "Song identification, emoji stickers, website previews and explicit media processing",
  usage:
    "shazam (reply to audio) | emojimix 😂+🔥 | audioeffect bass | screenshot <https URL>",
  handler,
});
