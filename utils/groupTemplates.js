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
  rules: [
    "📜 Quick rules: respect people, no spam/scam links, no unnecessary drama, no status-mention abuse, and listen when admins step in. Simple. 🤝",
  ],
  birthday: [
    "Birthday behaviour activated. 🎂🔥 Happy birthday {user}! More wins, less stress. 🥂",
    "{user} added another year of trouble. 😂 Happy birthday! 🥳",
    "Happy birthday {user}! 🎉 Bigger wins, better vibes, plenty money. 😌",
    "Today we allow {user} extra behaviour. 😂🎂 Happy birthday!",
  ],
  "birthday-confirmation": ["🎂 You entered *{date}*. If that’s correct, confirm it; if not, cancel and try again."],
  warning: [
    "Easy, {user}. 🌚 {reason}. Warning {warning}/{max}.",
    "Too far, {user}. Pull it back. 🫡 Warning {warning}/{max}.",
    "{user}, take it easy. 😂 {reason}. {warning}/{max}.",
    "Boundary spotted, {user}. Respect it. ⚠️ {warning}/{max}.",
  ],
  "final-warning": [
    "Last warning, {user}. Don’t make us boring. 😭 {reason}. {warning}/{max}.",
    "{user}, that’s the limit. 🫡 Admins may need to step in now.",
  ],
  "anti-link": [
    "Link check, {user}. 👀 That one isn’t approved here. Warning {warning}/{max}.",
    "{user}, suspicious/unapproved link spotted. 🛡️ Please don’t repost it. {warning}/{max}.",
    "That link failed the vibe check. 😂 {user}, warning {warning}/{max}.",
  ],
  "anti-link-action": ["{user}, link warning limit reached. 🛡️ {action}"],
  "anti-status": [
    "{user}, easy with the Status mentions. 📵 Strike {warning}/{max}.",
    "Status-tag police here. 😂 {user}, strike {warning}/{max}.",
    "{user}, don’t drag the whole group into Status. 🌚 {warning}/{max}.",
  ],
  "anti-status-final": ["{user}, Status-mention limit reached. 📵 {action}"],
  "anti-spam": [
    "Slow down, {user}. 😂 Alpha is seeing spam-like activity. {warning}/{max}.",
    "Omo, one message at a time. 😭 {user}, warning {warning}/{max}.",
    "{user}, the keyboard is not running away. 🌚 Ease up. {warning}/{max}.",
  ],
  muted: ["🔇 {user} is on a short timeout. Duration: {duration}. Reason: {reason}."],
  unmuted: ["🔊 {user} is back. Fresh start — don’t waste it. 😌"],
  removed: ["🚪 {user} has been removed. Reason: {reason}. Keep the group calm, please."],
  inactivity: ["📊 Activity check done: {count} member(s) reviewed. Don’t spam for numbers — real participation counts."],
  "inactivity-cleanup": ["🧹 Cleanup review ready: {count} member(s) matched. Admins, check the list before confirming."],
  "group-locked": ["🔒 House locked for a bit. Admins only. We’ll reopen when the dust settles. 🌚"],
  "group-reopened": ["🔓 Doors are open again. Come make sensible noise. 😂🔥"],
  announcement: ["📢 Quick one: {message}"],
  morning: [
    "Good morning, troublemakers. 🌚 Doors are open.",
    "Morning, {group}. ☀️ Who’s bringing the first gist? 👀",
    "Rise and shine. Today has enough problems — don’t add boring chat. 😂",
    "Good morning, people. ☕ New day, fresh vibes.",
  ],
  night: [
    "That’s enough trouble for tonight. 😂 Goodnight, {group}.",
    "House closed-ish. 🌚 Rest well, people.",
    "Night shift is ending. Same madness tomorrow. 😂🥂",
    "Goodnight, people. Charge your phone and your patience. 😭",
  ],
  game: ["🎮 Game time. Who’s brave?", "Game loading… choose confidence over sense. 😂🔥"],
  "game-result": ["🏆 Game done. Scores are in. Winner, enjoy your two minutes of fame. 😂"],
  event: [
    "📅 {event} is {when}. Don’t say Alpha didn’t tell you. 👀",
    "Quick reminder: *{event}* — {when}. Save yourself from 'I forgot'. 😂",
  ],
  poll: ["📊 Vote and move on. No campaign violence in the replies. 😂"],
  "game-join": ["🎮 Playing? Vote *Join*. Watching from the fence? Sit this one out. 👀"],
  "count-report": ["📊 Activity report ready for {count} member(s). Review first; kick/mute only if it actually makes sense."],
  "kick-count-confirmation": ["⚠️ You’re about to remove the last reviewed set. Check the names once more, then confirm."],
  "mute-count-confirmation": ["🔇 Bulk mute preview ready. Check the members and duration before confirming."],
  "security-alert": ["🛡️ Something triggered Alpha’s security check. Admins, review before taking extra action."],
  "member-cleared": ["✅ {user} is clear for now. Carry on."],
});

export const GROUP_TEMPLATES = Object.freeze(Object.fromEntries(GROUP_TEMPLATE_KEYS.map((key) => [key, POOLS[key]?.[0] || "Alpha update: {message}"])));

export const renderGroupTemplate = (key, values = {}) => {
  const pool = POOLS[key] || [GROUP_TEMPLATES[key] || "Alpha update: {message}"];
  const seed = `${key}:${values.group || ""}:${values.user || ""}:${values.event || ""}:${values.warning || ""}:${dayKey()}`;
  return fill(pool[hash(seed) % pool.length], values).slice(0, 700);
};

const INSIGHTS = [
  "Small consistency beats big promises.",
  "If the gist is good, bring context. 😂",
  "Drink water before choosing violence today. 😭",
  "Good vibes still need boundaries.",
  "Talk less like a press release, more like a human.",
  "No pressure — just make one useful move today.",
];
export const dailyInsightFor = (key = dayKey()) => INSIGHTS[hash(key) % INSIGHTS.length];
