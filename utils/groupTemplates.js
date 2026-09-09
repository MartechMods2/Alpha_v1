const clean = (value) => String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
const fill = (text, values = {}) => String(text).replace(/\{([a-z0-9_-]+)\}/gi, (_, key) => clean(values[key] ?? ""));
const hash = (value) => { let h = 2166136261; for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const dayKey = () => new Date().toISOString().slice(0, 10);

export const GROUP_TEMPLATE_KEYS = [
  "welcome", "goodbye", "rules", "birthday", "birthday-confirmation",
  "warning", "final-warning", "anti-link", "anti-link-action", "anti-status",
  "anti-status-final", "anti-spam", "muted", "unmuted", "removed",
  "inactivity", "inactivity-cleanup", "group-locked", "group-reopened",
  "announcement", "morning", "night", "game", "game-result", "event", "poll",
  "game-join", "count-report", "kick-count-confirmation", "mute-count-confirmation",
  "security-alert", "member-cleared",
];

export const GROUP_TEMPLATE_META = Object.freeze({
  welcome: { category: "community", title: "Welcome" }, goodbye: { category: "community", title: "Goodbye" }, rules: { category: "community", title: "Group Rules" },
  birthday: { category: "automation", title: "Birthday" }, "birthday-confirmation": { category: "automation", title: "Birthday Confirmation" },
  warning: { category: "moderation", title: "Warning" }, "final-warning": { category: "moderation", title: "Final Warning" },
  "anti-link": { category: "security", title: "Anti-Link Warning" }, "anti-link-action": { category: "security", title: "Anti-Link Final Action" },
  "anti-status": { category: "security", title: "Anti-Status Warning" }, "anti-status-final": { category: "security", title: "Anti-Status Final Strike" },
  "anti-spam": { category: "security", title: "Anti-Spam Warning" }, muted: { category: "moderation", title: "Member Muted" }, unmuted: { category: "moderation", title: "Member Unmuted" }, removed: { category: "moderation", title: "Member Removed" },
  inactivity: { category: "activity", title: "Activity Review" }, "inactivity-cleanup": { category: "activity", title: "Inactive Cleanup" },
  "group-locked": { category: "moderation", title: "Group Locked" }, "group-reopened": { category: "moderation", title: "Group Reopened" }, announcement: { category: "community", title: "Announcement" },
  morning: { category: "automation", title: "Good Morning" }, night: { category: "automation", title: "Good Night" }, game: { category: "games", title: "Game Start" }, "game-result": { category: "games", title: "Game Result" }, event: { category: "automation", title: "Event Reminder" }, poll: { category: "community", title: "Poll" }, "game-join": { category: "games", title: "Game Join Poll" },
  "count-report": { category: "activity", title: "Activity Report" }, "kick-count-confirmation": { category: "activity", title: "Kick Review" }, "mute-count-confirmation": { category: "activity", title: "Mute Review" }, "security-alert": { category: "security", title: "Security Alert" }, "member-cleared": { category: "moderation", title: "Member Cleared" },
});

const POOLS = Object.freeze({
  welcome: [
    "New blood has entered. 🌚 Welcome, {user}.",
    "{user} just entered {group}. Behave yourselves. 😂",
    "Welcome {user} 🫶 Don’t be shy — say hi.",
    "Another human unlocked. 😂 Welcome, {user}.",
    "{user} is in. Make yourself at home. 🔥",
    "Fresh face alert 👀 Welcome, {user}.",
    "{user}, welcome to the madness. Keep it respectful. 😂",
  ],
  goodbye: [
    "{user} has left the building. 🚪🌚",
    "Damn… {user} escaped. 😂",
    "{user} chose freedom. We respect it. 🫡",
    "One soldier down. 🥲 {user} is out.",
    "{user} left with no farewell speech? 😭",
    "And just like that, {user} is gone. 👀",
  ],
  rules: ["📜 Quick rules: respect people, no spam/scam links, no unnecessary drama, no Status-mention abuse, and listen when admins step in. Simple. 🤝"],
  birthday: [
    "Birthday behaviour activated. 🎂🔥 Happy birthday {user}! More wins, less stress. 🥂",
    "{user} added another year of trouble. 😂 Happy birthday! 🥳",
    "Happy birthday {user}! 🎉 Bigger wins, better vibes, plenty money. 😌",
    "Today we allow {user} extra behaviour. 😂🎂 Happy birthday!",
  ],
  "birthday-confirmation": ["🎂 You entered *{date}*. If that’s correct, confirm it; if not, cancel and try again."],
  warning: [
    "Easy, {user}. 🌚 {reason} in {group}. Warning {warning}/{max}. {action}",
    "Too far, {user}. Pull it back in {group}. 🫡 {warning}/{max}. {action}",
    "{user}, take it easy in {group}. 😂 {reason}. {warning}/{max}. {action}",
    "Boundary spotted in {group}, {user}. Respect it. ⚠️ {warning}/{max}. {action}",
  ],
  "final-warning": [
    "Last warning, {user}. Don’t make us boring. 😭 {reason}. {warning}/{max}. {action}",
    "{user}, that’s the limit in {group}. 🫡 {warning}/{max}. {action}",
  ],
  "anti-link": [
    "Link check, {user}. 👀 That one isn’t approved in {group}. {warning}/{max}. {action}",
    "{user}, unapproved link spotted in {group}. 🛡️ Don’t repost it. {warning}/{max}. {action}",
    "That link failed the vibe check in {group}. 😂 {user}, {warning}/{max}. {action}",
  ],
  "anti-link-action": ["{user}, link warning limit reached in {group}. 🛡️ {action}"],
  "anti-status": [
    "{user}, easy with the Status mentions in {group}. 📵 {warning}/{max}. {action}",
    "Status-tag police here. 😂 {user}, {warning}/{max} in {group}. {action}",
    "{user}, don’t drag the whole group into Status. 🌚 {warning}/{max}. {action}",
  ],
  "anti-status-final": ["{user}, Status-mention limit reached in {group}. 📵 {action}"],
  "anti-spam": [
    "Slow down, {user}. 😂 Spam-like activity in {group}. {warning}/{max}. {action}",
    "Omo, one message at a time. 😭 {user}, {warning}/{max} in {group}. {action}",
    "{user}, the keyboard isn’t running away. 🌚 Ease up. {warning}/{max}. {action}",
  ],
  muted: ["🔇 {user} is on a short timeout in {group}. {duration}. Reason: {reason}."],
  unmuted: ["🔊 {user} is back in {group}. Fresh start — don’t waste it. 😌"],
  removed: ["🚪 {user} has been removed from {group}. Reason: {reason}. Keep things calm, please."],
  inactivity: ["📊 Activity check done in {group}: {count} member(s) reviewed. Don’t spam for numbers — real participation counts."],
  "inactivity-cleanup": ["🧹 Cleanup review ready in {group}: {count} member(s) matched. Admins, check the list before confirming."],
  "group-locked": ["🔒 {group} is locked for a bit. Admins only. We’ll reopen when the dust settles. 🌚"],
  "group-reopened": ["🔓 {group} is open again. Come make sensible noise. 😂🔥"],
  announcement: ["📢 Quick one for {group}: {message}"],
  morning: [
    "Good morning, troublemakers. 🌚 Doors are open.",
    "Morning, {group}. ☀️ Who’s bringing the first gist? 👀",
    "Rise and shine. Today has enough problems — don’t add boring chat. 😂",
    "Good morning, people. ☕ New day, fresh vibes.",
  ],
  night: [
    "That’s enough trouble for tonight. 😂 Goodnight, {group}.",
    "House closed-ish. 🌚 Rest well, {group}.",
    "Night shift is ending. Same madness tomorrow. 😂🥂",
    "Goodnight, people. Charge your phone and your patience. 😭",
  ],
  game: ["🎮 Game time in {group}. Who’s brave?", "Game loading in {group}… choose confidence over sense. 😂🔥"],
  "game-result": ["🏆 Game done in {group}. Winner: {winner}. Score: {score}. Enjoy your two minutes of fame. 😂"],
  event: [
    "📅 {event} is {when} in {group}. Don’t say Alpha didn’t tell you. 👀",
    "Quick reminder for {group}: *{event}* — {when}. Save yourself from 'I forgot'. 😂",
  ],
  poll: ["📊 New poll in {group}: {question}. Vote and move on — no campaign violence. 😂"],
  "game-join": ["🎮 {group}, playing? Vote *Join*. Watching from the fence? Sit this one out. 👀"],
  "count-report": ["📊 {group} activity report: {count} member(s) reviewed. Review first; kick/mute only if it actually makes sense."],
  "kick-count-confirmation": ["⚠️ {group}: you’re about to remove {count} reviewed member(s). Check the names once more, then confirm."],
  "mute-count-confirmation": ["🔇 {group}: bulk mute preview for {count} member(s), {duration}. Check the list before confirming."],
  "security-alert": ["🛡️ Something triggered Alpha’s security check in {group}: {reason}. Admins, review before taking extra action."],
  "member-cleared": ["✅ {user} is clear in {group} for now. Carry on."],
});

export const GROUP_TEMPLATES = Object.freeze(Object.fromEntries(GROUP_TEMPLATE_KEYS.map((key) => [key, POOLS[key]?.[0] || "Alpha update: {message}"])));

export const renderGroupTemplate = (key, values = {}) => {
  const pool = POOLS[key] || [GROUP_TEMPLATES[key] || "Alpha update: {message}"];
  const seed = `${key}:${values.group || ""}:${values.user || ""}:${values.event || ""}:${values.warning || ""}:${dayKey()}`;
  return fill(pool[hash(seed) % pool.length], values).slice(0, 700);
};

export const groupTemplatePlaceholders = (key) => [
  ...new Set((GROUP_TEMPLATES[key]?.match(/\{[a-zA-Z0-9_-]+\}/g) || []).map((value) => value.slice(1, -1))),
];

const INSIGHTS = [
  "Small consistency beats big promises.",
  "If the gist is good, bring context. 😂",
  "Drink water before choosing violence today. 😭",
  "Good vibes still need boundaries.",
  "Talk less like a press release, more like a human.",
  "No pressure — just make one useful move today.",
];
export const dailyInsightFor = (key = dayKey()) => INSIGHTS[hash(key) % INSIGHTS.length];
