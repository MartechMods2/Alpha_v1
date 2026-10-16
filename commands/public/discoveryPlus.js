import { load } from "cheerio";
import {
  featureJSON,
  publicRequest,
  publicRepo,
} from "../../utils/featureHttp.js";
import { createCanvas } from "@napi-rs/canvas";
import { imageBufferToSticker } from "../../utils/mediaStudio.js";
import { runMediaJob } from "../../utils/mediaJobs.js";
const q = (value) => encodeURIComponent(value);
const txt = (value) =>
  String(value || "")
    .replace(/[\u0000-\u001f]/g, " ")
    .slice(0, 700);
const required = (value, usage) => {
  if (!value) throw Error(`Usage: ${usage}`);
  return value;
};
export async function discoveryLookup(command, args) {
  const query = args.join(" ").trim().slice(0, 200);
  if (command === "worldclock")
    return required(query, "worldclock Africa/Lagos Europe/London")
      .split(/\s+/)
      .slice(0, 5)
      .map((zone) => {
        const aliases = {
          lagos: "Africa/Lagos",
          london: "Europe/London",
          tokyo: "Asia/Tokyo",
          newyork: "America/New_York",
        };
        const timeZone = aliases[zone.toLowerCase()] || zone;
        try {
          return `${timeZone}: ${new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
        } catch {
          throw Error("Use IANA zones, such as Africa/Lagos or Europe/London.");
        }
      })
      .join("\n");
  required(query, `${command} <search>`);
  if (command === "githubsearch") {
    const data = await featureJSON(
      `https://api.github.com/search/repositories?q=${q(query)}&per_page=5`,
    );
    return (data.items || [])
      .map(
        (x) =>
          `${x.full_name} • ⭐ ${x.stargazers_count}\n${txt(x.description)}\n${x.html_url}`,
      )
      .join("\n\n");
  }
  if (command === "npmsearch") {
    const data = await featureJSON(
      `https://registry.npmjs.org/-/v1/search?text=${q(query)}&size=5`,
    );
    return (data.objects || [])
      .map(
        ({ package: p }) =>
          `${p.name} ${p.version}\n${txt(p.description)}\nhttps://www.npmjs.com/package/${q(p.name)}`,
      )
      .join("\n\n");
  }
  if (["animeinfo", "manga"].includes(command)) {
    const data = await featureJSON(
      `https://api.jikan.moe/v4/${command === "manga" ? "manga" : "anime"}?q=${q(query)}&sfw=true&limit=3`,
    );
    return (data.data || [])
      .map(
        (x) =>
          `${x.title}\n${x.status} • ${x.episodes || x.chapters || "?"} episodes/chapters\n${txt(x.synopsis)}\n${x.url}`,
      )
      .join("\n\n");
  }
  if (command === "book") {
    const data = await featureJSON(
      `https://openlibrary.org/search.json?q=${q(query)}&limit=5&fields=key,title,author_name,first_publish_year`,
    );
    return (data.docs || [])
      .map(
        (x) =>
          `${x.title} — ${(x.author_name || []).join(", ")} (${x.first_publish_year || "year unknown"})\nhttps://openlibrary.org${x.key}`,
      )
      .join("\n\n");
  }
  if (command === "recipe") {
    const data = await featureJSON(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${q(query)}`,
    );
    return (data.meals || [])
      .slice(0, 2)
      .map(
        (x) =>
          `${x.strMeal}\n${Array.from({ length: 20 }, (_, i) =>
            [x["strMeasure" + (i + 1)], x["strIngredient" + (i + 1)]]
              .filter(Boolean)
              .join(" "),
          )
            .filter((x) => x.trim())
            .join(
              ", ",
            )}\n\n${txt(x.strInstructions)}\n${x.strSource || x.strYoutube || ""}`,
      )
      .join("\n\n");
  }
  if (command === "movie") {
    if (!process.env.OMDB_API_KEY)
      throw Error("Movie lookup needs OMDB_API_KEY configured by the owner.");
    const x = await featureJSON(
      `https://www.omdbapi.com/?apikey=${q(process.env.OMDB_API_KEY)}&t=${q(query)}`,
    );
    if (x.Response === "False") return "No matching film found.";
    return `${x.Title} (${x.Year})\n${x.Genre} • ${x.Runtime}\nCast: ${x.Actors}\n${x.Plot}\nIMDb: ${x.imdbRating}\nhttps://www.imdb.com/title/${x.imdbID}/`;
  }
  if (command === "currency") {
    const [amount, base, to] = args;
    const n = Number(amount);
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      n > 1e12 ||
      !/^\w{3}$/.test(base || "") ||
      !/^\w{3}$/.test(to || "")
    )
      throw Error("Usage: currency 100 USD NGN");
    const x = await featureJSON(
      `https://open.er-api.com/v6/latest/${base.toUpperCase()}`,
    );
    const rate = x.rates?.[to.toUpperCase()];
    if (!rate) throw Error("Currency is not supported.");
    return `${n} ${base.toUpperCase()} = ${(n * rate).toLocaleString("en-NG", { maximumFractionDigits: 4 })} ${to.toUpperCase()}\nUpdated: ${x.time_last_update_utc}\nIndicative rates • https://www.exchangerate-api.com`;
  }
  if (command === "football") {
    if (!process.env.FOOTBALL_API_KEY)
      throw Error(
        "Football fixtures need FOOTBALL_API_KEY (football-data.org).",
      );
    const x = await featureJSON("https://api.football-data.org/v4/matches", {
      headers: { "X-Auth-Token": process.env.FOOTBALL_API_KEY },
    });
    return (x.matches || [])
      .filter(
        (x) =>
          query === "today" ||
          `${x.homeTeam?.name} ${x.awayTeam?.name}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .slice(0, 8)
      .map(
        (x) =>
          `${x.homeTeam.name} vs ${x.awayTeam.name}\n${x.utcDate} • ${x.status} • ${x.score?.fullTime?.home ?? "-"}:${x.score?.fullTime?.away ?? "-"}`,
      )
      .join("\n\n");
  }
  if (command === "playstore") {
    const url = `https://play.google.com/store/search?q=${q(query)}&c=apps`;
    const r = await publicRequest(url);
    const $ = load(r.buffer.toString());
    const seen = new Set();
    const apps = [];
    $('a[href*="/store/apps/details?id="]').each((_, el) => {
      const href = $(el).attr("href");
      if (seen.has(href)) return;
      seen.add(href);
      const title = $(el).text().trim().replace(/\s+/g, " ").slice(0, 180);
      if (title)
        apps.push(`${title}\n${new URL(href, "https://play.google.com").href}`);
    });
    return apps.slice(0, 5).join("\n\n") || `Official store results: ${url}`;
  }
  if (command === "spotifysearch") {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET)
      throw Error(
        "Spotify catalogue lookup needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
      );
    const token = await featureJSON("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.SPOTIFY_CLIENT_ID +
              ":" +
              process.env.SPOTIFY_CLIENT_SECRET,
          ).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const x = await featureJSON(
      `https://api.spotify.com/v1/search?q=${q(query)}&type=track&limit=5`,
      { headers: { Authorization: "Bearer " + token.access_token } },
    );
    return (x.tracks?.items || [])
      .map(
        (x) =>
          `${x.name} — ${x.artists.map((a) => a.name).join(", ")}\n${x.album.name} • ${Math.round(x.duration_ms / 1000)}s\n${x.external_urls.spotify}`,
      )
      .join("\n\n");
  }
  if (command === "shorten") {
    const url = new URL(query);
    if (url.protocol !== "https:" || url.username || url.password)
      throw Error("Use a public HTTPS link.");
    await publicRequest(url.href, { method: "HEAD", maxBytes: 1024 });
    const r = await publicRequest(
      `https://tinyurl.com/api-create.php?url=${q(query)}`,
    );
    if (r.status !== 200) throw Error("Short-link provider unavailable.");
    return r.buffer.toString();
  }
  return "";
}
const handler = async (sock, msg, from, args, info) => {
  const send = (payload) =>
    info.sendMessageWTyping(from, payload, { quoted: msg });
  try {
    if (info.command === "gitclone")
      return await runMediaJob({
        feature: "gitclone",
        groupJid: from,
        senderJid: info.senderJid,
        task: async () => {
          const repo = publicRepo(args[0]);
          const meta = await featureJSON(
            `https://api.github.com/repos/${repo}`,
          );
          if (meta.private || meta.size > 20000)
            throw Error(
              "Only public repositories under 20 MB advertised size are supported.",
            );
          const r = await publicRequest(
            `https://api.github.com/repos/${repo}/zipball`,
            { maxBytes: 20 * 1024 * 1024 },
          );
          if (r.status !== 200) throw Error("Repository download failed.");
          return send({
            document: r.buffer,
            fileName: repo.replace("/", "-") + ".zip",
            mimetype: "application/zip",
          });
        },
      });
    if (["brat", "codeimage"].includes(info.command)) {
      const text = (
        args.join(" ") ||
        info.extendedMessageOriginal?.quotedMessage?.conversation ||
        info.extendedMessageOriginal?.quotedMessage?.extendedTextMessage
          ?.text ||
        ""
      ).slice(0, 1500);
      required(text, info.command + " <text, or reply to text>");
      return await runMediaJob({
        feature: info.command,
        groupJid: from,
        senderJid: info.senderJid,
        task: async () => {
          const c = createCanvas(1000, 600),
            ctx = c.getContext("2d");
          ctx.fillStyle = info.command === "brat" ? "#8ace00" : "#0f172a";
          ctx.fillRect(0, 0, 1000, 600);
          ctx.fillStyle = info.command === "brat" ? "#111111" : "#e2e8f0";
          ctx.font =
            info.command === "brat" ? "bold 48px sans-serif" : "24px monospace";
          const lines = text.match(/.{1,58}(?:\s|$)|.{1,58}/g) || [];
          lines
            .slice(0, 17)
            .forEach((line, i) => ctx.fillText(line, 40, 65 + i * 30, 920));
          const image = c.toBuffer("image/png");
          return send(
            info.command === "brat"
              ? {
                  sticker: await imageBufferToSticker(image, {
                    pack: "Alpha Brat",
                    author: "Martech",
                  }),
                }
              : { image, caption: "Alpha • Code Studio" },
          );
        },
      });
    }
    const text = await discoveryLookup(info.command, args);
    return send({ text: text || "No matching results found." });
  } catch (error) {
    const message =
      /needs |Usage:|Use IANA|Use owner|not supported|under 20 MB|not permitted/.test(
        error.message,
      )
        ? error.message
        : `${info.command} could not complete. Check its usage or service availability.`;
    return send({ text: message });
  }
};
export default () => ({
  cmd: [
    "githubsearch",
    "gitclone",
    "npmsearch",
    "animeinfo",
    "manga",
    "book",
    "recipe",
    "movie",
    "currency",
    "football",
    "playstore",
    "spotifysearch",
    "worldclock",
    "shorten",
    "brat",
    "codeimage",
  ],
  desc: "On-demand discovery, catalogue search, clocks and creative cards",
  usage:
    "githubsearch <query> | worldclock Africa/Lagos | currency 100 USD NGN | brat <text>",
  handler,
});
