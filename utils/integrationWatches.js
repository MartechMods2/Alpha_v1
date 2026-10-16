import { safePackItems } from "../db/safePackData.js";
import { publicRequest, featureJSON } from "./featureHttp.js";
import { load } from "cheerio";
import messageQueue from "../queue/messageQueue.js";
let running = false,
  timer;
export async function checkIntegrationWatches(sock) {
  if (running || !sock.user) return;
  running = true;
  try {
    const rows = await safePackItems
      .find({
        type: { $in: ["rss-watch", "uptime-watch", "github-watch"] },
        status: "active",
      })
      .limit(100)
      .toArray();
    for (const row of rows) {
      let state, notification;
      try {
        if (row.type === "uptime-watch") {
          try {
            const r = await publicRequest(row.text, {
              method: "HEAD",
              maxBytes: 1024,
            });
            state = r.status >= 200 && r.status < 400 ? "up" : "down";
          } catch {
            state = "unreachable";
          }
          if (row.payload?.state && row.payload.state !== state)
            notification = `🌐 ${row.text}\nStatus: ${state}. This is Alpha's observation, not proof of a global outage.`;
        }
        if (row.type === "github-watch") {
          const releases = await featureJSON(
            `https://api.github.com/repos/${row.text}/releases?per_page=1`,
          );
          state = releases[0]?.id || "none";
          if (row.payload?.state && row.payload.state !== state && releases[0])
            notification = `📦 New release: ${row.text}\n${releases[0].name || releases[0].tag_name}\n${releases[0].html_url}`;
        }
        if (row.type === "rss-watch") {
          const r = await publicRequest(row.text, { maxBytes: 1024 * 1024 });
          if (r.status !== 200) continue;
          const $ = load(r.buffer.toString(), { xmlMode: true });
          const items = $("item,entry")
            .slice(0, 3)
            .toArray()
            .map((el) => ({
              id:
                $(el).find("guid,id").first().text() ||
                $(el).find("link").first().attr("href") ||
                $(el).find("link").first().text(),
              title: $(el).find("title").first().text().slice(0, 160),
              link:
                $(el).find("link").first().attr("href") ||
                $(el).find("link").first().text(),
            }));
          state = items[0]?.id;
          if (!state) continue;
          if (row.payload?.state && row.payload.state !== state) {
            const fresh = items.slice(
              0,
              Math.max(
                0,
                items.findIndex((x) => x.id === row.payload.state) === -1
                  ? items.length
                  : items.findIndex((x) => x.id === row.payload.state),
              ),
            );
            notification =
              "📰 Feed updates\n\n" +
              fresh
                .map(
                  (x) =>
                    `${x.title}\n${/^https:\/\//.test(x.link) ? x.link : ""}`,
                )
                .join("\n\n");
          }
        }
        if (notification)
          await messageQueue.enqueue(
            row.groupJid,
            () => sock.sendMessage(row.groupJid, { text: notification }),
            2,
          );
        await safePackItems.updateOne(
          { _id: row._id },
          { $set: { payload: { state }, updatedAt: new Date() } },
        );
      } catch {
        /* One provider failure must not stop other groups. */
      }
    }
  } finally {
    running = false;
  }
}
export function startIntegrationWatches(sock) {
  if (timer) clearInterval(timer);
  const handle = setInterval(
    () => void checkIntegrationWatches(sock).catch(() => {}),
    15 * 60000,
  );
  timer = handle;
  handle.unref?.();
  sock.ws?.once?.("close", () => {
    clearInterval(handle);
    if (timer === handle) timer = null;
  });
}
