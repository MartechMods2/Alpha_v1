import { createCanvas, loadImage } from "@napi-rs/canvas";

export const ACTIONS = Object.freeze({
	slap: { verb: "SLAPS", emoji: "👋", tone: "rough", scene: "hit", accent: "#ef4444" },
	beat: { verb: "BEATS", emoji: "🥊", tone: "rough", scene: "hit", accent: "#dc2626" },
	punch: { verb: "PUNCHES", emoji: "🥊", tone: "rough", scene: "hit", accent: "#f97316" },
	kick: { verb: "KICKS", emoji: "💥", tone: "rough", scene: "kick", accent: "#ea580c" },
	bonk: { verb: "BONKS", emoji: "🔨", tone: "rough", scene: "hit", accent: "#a855f7" },
	bite: { verb: "BITES", emoji: "😬", tone: "rough", scene: "chase", accent: "#7c3aed" },
	chase: { verb: "CHASES", emoji: "🏃", tone: "rough", scene: "chase", accent: "#2563eb" },
	roast: { verb: "ROASTS", emoji: "🔥", tone: "rough", scene: "laugh", accent: "#dc2626" },
	hug: { verb: "HUGS", emoji: "🤗", tone: "friendly", scene: "hug", accent: "#ec4899" },
	kiss: { verb: "KISSES", emoji: "😘", tone: "friendly", scene: "hug", accent: "#f43f5e" },
	pat: { verb: "PATS", emoji: "🫳", tone: "friendly", scene: "pat", accent: "#14b8a6" },
	poke: { verb: "POKES", emoji: "👉", tone: "friendly", scene: "hit", accent: "#06b6d4" },
	wave: { verb: "WAVES AT", emoji: "👋", tone: "friendly", scene: "wave", accent: "#0ea5e9" },
	highfive: { verb: "HIGH-FIVES", emoji: "🙌", tone: "friendly", scene: "highfive", accent: "#22c55e" },
	cheer: { verb: "CHEERS", emoji: "📣", tone: "friendly", scene: "wave", accent: "#16a34a" },
	cuddle: { verb: "CUDDLES", emoji: "🫂", tone: "friendly", scene: "hug", accent: "#db2777" },
	dance: { verb: "DANCES WITH", emoji: "💃", tone: "friendly", scene: "dance", accent: "#8b5cf6" },
	laugh: { verb: "LAUGHS WITH", emoji: "😂", tone: "friendly", scene: "laugh", accent: "#eab308" },
	cry: { verb: "CRIES TO", emoji: "😭", tone: "friendly", scene: "cry", accent: "#3b82f6" },
	wink: { verb: "WINKS AT", emoji: "😉", tone: "friendly", scene: "wave", accent: "#f59e0b" },
	feed: { verb: "FEEDS", emoji: "🍕", tone: "friendly", scene: "pat", accent: "#f97316" },
	salute: { verb: "SALUTES", emoji: "🫡", tone: "friendly", scene: "wave", accent: "#0891b2" },
	tickle: { verb: "TICKLES", emoji: "🤣", tone: "friendly", scene: "laugh", accent: "#84cc16" },
	boop: { verb: "BOOPS", emoji: "👉", tone: "friendly", scene: "pat", accent: "#10b981" },
});

export const ACTION_COMMANDS = Object.freeze(Object.keys(ACTIONS));
export const FRIENDLY_ACTIONS = Object.freeze(ACTION_COMMANDS.filter((name) => ACTIONS[name].tone === "friendly"));

const cleanName = (value) => String(value || "Member").replace(/[\u0000-\u001f*_~`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 20) || "Member";
const initials = (name) => cleanName(name).split(" ").slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
const colorFromName = (name) => {
	const colors = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#db2777", "#dc2626"];
	const score = [...cleanName(name)].reduce((sum, char) => sum + char.codePointAt(0), 0);
	return colors[score % colors.length];
};

const starPath = (ctx, x, y, outer = 54, inner = 22, points = 10) => {
	ctx.beginPath();
	for (let index = 0; index < points * 2; index += 1) {
		const radius = index % 2 === 0 ? outer : inner;
		const angle = -Math.PI / 2 + (index * Math.PI) / points;
		const px = x + Math.cos(angle) * radius;
		const py = y + Math.sin(angle) * radius;
		if (index === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
};

const drawAvatar = async (ctx, buffer, name, x, y, radius) => {
	ctx.save();
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.clip();
	ctx.fillStyle = colorFromName(name);
	ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
	if (Buffer.isBuffer(buffer) && buffer.length) {
		try {
			const image = await loadImage(buffer);
			const scale = Math.max((radius * 2) / image.width, (radius * 2) / image.height);
			const width = image.width * scale;
			const height = image.height * scale;
			ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
		} catch {
			ctx.fillStyle = "#ffffff";
			ctx.font = `900 ${Math.round(radius * 0.72)}px sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(initials(name), x, y + 2);
		}
	} else {
		ctx.fillStyle = "#ffffff";
		ctx.font = `900 ${Math.round(radius * 0.72)}px sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(initials(name), x, y + 2);
	}
	ctx.restore();
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 9;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.stroke();
};

const drawBody = (ctx, x, headY, color, lean = 0) => {
	ctx.strokeStyle = color;
	ctx.lineWidth = 24;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(x, headY + 66);
	ctx.lineTo(x + lean, headY + 145);
	ctx.moveTo(x + lean, headY + 118);
	ctx.lineTo(x - 42, headY + 184);
	ctx.moveTo(x + lean, headY + 118);
	ctx.lineTo(x + 48, headY + 184);
	ctx.stroke();
};

const drawScene = (ctx, scene, accent) => {
	ctx.strokeStyle = "#172033";
	ctx.fillStyle = accent;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	if (["hit", "pat"].includes(scene)) {
		ctx.lineWidth = 28;
		ctx.beginPath();
		ctx.moveTo(188, 270);
		ctx.quadraticCurveTo(255, scene === "pat" ? 185 : 235, 318, scene === "pat" ? 212 : 242);
		ctx.stroke();
		ctx.fillStyle = scene === "pat" ? "#f6c89f" : accent;
		ctx.beginPath();
		ctx.arc(326, scene === "pat" ? 210 : 242, 28, 0, Math.PI * 2);
		ctx.fill();
		if (scene === "hit") {
			ctx.fillStyle = "#fde047";
			starPath(ctx, 352, 225, 47, 18, 9);
			ctx.fill();
		}
	} else if (scene === "kick") {
		ctx.lineWidth = 30;
		ctx.beginPath();
		ctx.moveTo(188, 332);
		ctx.quadraticCurveTo(270, 315, 330, 265);
		ctx.stroke();
		ctx.fillStyle = "#fde047";
		starPath(ctx, 356, 244, 47, 18, 9);
		ctx.fill();
	} else if (scene === "hug") {
		ctx.strokeStyle = accent;
		ctx.lineWidth = 25;
		ctx.beginPath();
		ctx.arc(256, 286, 104, 0.08 * Math.PI, 0.92 * Math.PI);
		ctx.stroke();
		ctx.font = "64px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("♥", 256, 250);
	} else if (scene === "highfive") {
		ctx.lineWidth = 26;
		ctx.beginPath();
		ctx.moveTo(178, 286);
		ctx.lineTo(247, 209);
		ctx.moveTo(334, 286);
		ctx.lineTo(265, 209);
		ctx.stroke();
		ctx.fillStyle = "#fde047";
		starPath(ctx, 256, 195, 45, 18, 8);
		ctx.fill();
	} else if (scene === "dance" || scene === "wave") {
		ctx.lineWidth = 22;
		ctx.beginPath();
		ctx.moveTo(178, 280);
		ctx.lineTo(125, 216);
		ctx.moveTo(334, 280);
		ctx.lineTo(388, 216);
		ctx.stroke();
		ctx.fillStyle = accent;
		ctx.font = "48px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText(scene === "dance" ? "♫" : "✦", 256, 220);
	} else if (scene === "laugh" || scene === "cry") {
		ctx.font = "70px sans-serif";
		ctx.textAlign = "center";
		ctx.fillStyle = scene === "laugh" ? "#facc15" : "#38bdf8";
		ctx.fillText(scene === "laugh" ? "HA!" : "•••", 256, 250);
	} else if (scene === "chase") {
		ctx.strokeStyle = accent;
		ctx.lineWidth = 14;
		for (let index = 0; index < 3; index += 1) {
			ctx.beginPath();
			ctx.moveTo(214 - index * 16, 220 + index * 27);
			ctx.lineTo(282 - index * 16, 220 + index * 27);
			ctx.stroke();
		}
	}
};

export const getActionDefinition = (name) => ACTIONS[String(name || "").toLowerCase()] || null;

export const createActionStickerImage = async ({
	action,
	actorName,
	targetName,
	actorAvatar = null,
	targetAvatar = null,
}) => {
	const definition = getActionDefinition(action);
	if (!definition) throw new Error("Unknown action");
	const actor = cleanName(actorName);
	const target = cleanName(targetName);
	const canvas = createCanvas(512, 512);
	const ctx = canvas.getContext("2d");

	ctx.clearRect(0, 0, 512, 512);
	const gradient = ctx.createLinearGradient(24, 24, 488, 488);
	gradient.addColorStop(0, "rgba(255,255,255,0.98)");
	gradient.addColorStop(1, `${definition.accent}dd`);
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.roundRect(16, 16, 480, 480, 74);
	ctx.fill();
	ctx.strokeStyle = "rgba(255,255,255,0.9)";
	ctx.lineWidth = 8;
	ctx.stroke();

	drawBody(ctx, 150, 192, "#172033", definition.scene === "chase" ? 22 : 0);
	drawBody(ctx, 362, 192, "#172033", definition.scene === "hit" ? 16 : 0);
	await Promise.all([
		drawAvatar(ctx, actorAvatar, actor, 150, 172, 70),
		drawAvatar(ctx, targetAvatar, target, 362, 172, 70),
	]);
	drawScene(ctx, definition.scene, definition.accent);

	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = "#111827";
	ctx.font = "900 38px sans-serif";
	ctx.fillText(`${definition.emoji} ${definition.verb}`, 256, 392);
	ctx.font = "800 25px sans-serif";
	ctx.fillText(`${actor}  →  ${target}`, 256, 438);
	ctx.fillStyle = "rgba(17,24,39,0.58)";
	ctx.font = "700 14px sans-serif";
	ctx.fillText("ALPHA ACTION STUDIO", 256, 473);
	return canvas.toBuffer("image/png");
};
