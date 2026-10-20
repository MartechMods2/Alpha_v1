import { createCanvas } from "@napi-rs/canvas";
const cache = new Map();
const number = (n) => n.toLocaleString("en-US");
export function shopCardPayload(rows, category, page, pages, caption) {
  try {
    const shown = rows.slice(0, 8);
    const key = JSON.stringify([
      shown.map((x) => [x.id, x.price, x.evo]),
      category,
      page,
      pages,
    ]);
    if (cache.has(key)) return { image: cache.get(key), caption };
    const canvas = createCanvas(1000, 1420),
      ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 1000, 1420);
    gradient.addColorStop(0, "#10192e");
    gradient.addColorStop(1, "#20172c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1000, 1420);
    ctx.strokeStyle = "#d9bc7d";
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, 944, 1364);
    ctx.fillStyle = "#d9bc7d";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("ALPHA  /  THE AURA ATELIER", 60, 86);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px sans-serif";
    ctx.fillText("The Collection", 60, 169);
    ctx.fillStyle = "#b5bfd2";
    ctx.font = "24px sans-serif";
    ctx.fillText(
      `${category.toUpperCase()}  /  ${page} OF ${pages}  /  PRICE: HIGH TO LOW`,
      60,
      218,
    );
    shown.forEach((item, i) => {
      const y = 270 + i * 125;
      const special = item.evo === 6,
        accent = special ? "#ffe6a0" : item.evo ? "#bdacff" : "#78dcc8";
      ctx.fillStyle = special ? "#322b20" : "#1b263a";
      ctx.fillRect(58, y, 884, 110);
      ctx.fillStyle = accent;
      ctx.fillRect(58, y, 5, 110);
      ctx.font = "bold 23px sans-serif";
      ctx.fillText(item.name, 82, y + 33, 540);
      ctx.fillStyle = "#c1cada";
      ctx.font = "19px sans-serif";
      ctx.fillText(item.id, 82, y + 61, 530);
      ctx.fillStyle = accent;
      ctx.font = "bold 19px sans-serif";
      ctx.fillText(
        item.evo === 6
          ? "EVO-LEGENDARY+"
          : item.evo
            ? "EVO EXCLUSIVE"
            : item.kind.toUpperCase(),
        82,
        y + 89,
      );
      ctx.textAlign = "right";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(number(item.price), 918, y + 47, 285);
      ctx.font = "17px sans-serif";
      ctx.fillText("AURA", 918, y + 75);
      ctx.textAlign = "left";
    });
    ctx.fillStyle = "#d9bc7d";
    ctx.font = "bold 23px sans-serif";
    ctx.fillText("$aura shop buy <item-id>", 60, 1330);
    ctx.fillStyle = "#b5bfd2";
    ctx.font = "18px sans-serif";
    ctx.fillText(
      "Permanent style. Clear prices. No paid mystery boxes.",
      60,
      1363,
    );
    const image = canvas.toBuffer("image/png");
    if (cache.size >= 16) cache.delete(cache.keys().next().value);
    cache.set(key, image);
    return { image, caption };
  } catch {
    return { text: caption };
  }
}
