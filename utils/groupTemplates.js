export const GROUP_TEMPLATE_KEYS = [
	"welcome", "goodbye", "rules", "birthday", "warning", "announcement", "morning", "night", "game", "inactivity", "event", "poll",
];

export const GROUP_TEMPLATES = {
	welcome: `╭─ 👋 *WELCOME TO {group}*
│
│ Hey {user}, great to have you here.
│ You are member *#{count}*.
│
│ Start by checking the group rules, introduce yourself naturally, and join the conversation.
│
│ 🤖 Powered by ⚡Alpha⚡
╰──────────────────`,
	goodbye: `╭─ 👋 *GOODBYE*
│
│ {user} has left *{group}*.
│ We wish you the best ahead.
╰──────────────────`,
	rules: `╭─ 📜 *GROUP RULES*
│
│ 1. Respect every member.
│ 2. No spam, flooding or unnecessary promotions.
│ 3. No harmful, explicit or illegal content.
│ 4. Keep discussions relevant and constructive.
│ 5. Do not impersonate members or admins.
│ 6. Follow admin instructions and WhatsApp rules.
│ 7. Disagreements are fine; insults and harassment are not.
│
│ Repeated violations may lead to warnings or removal.
╰──────────────────`,
	birthday: `╭─ 🎂 *HAPPY BIRTHDAY*
│
│ Today we celebrate {user}! 🎉
│ May this new year bring progress, good health, strong friendships and plenty of wins.
│
│ Have a brilliant day from everyone in *{group}*.
╰──────────────────`,
	warning: `╭─ ⚠️ *GROUP WARNING*
│
│ Member: {user}
│ Reason: {reason}
│ Warning: {warning}/{max}
│
│ Please correct the behaviour and keep the group comfortable for everyone.
╰──────────────────`,
	announcement: `╭─ 📢 *GROUP ANNOUNCEMENT*
│
│ {message}
│
│ Please take note and respond where necessary.
╰──────────────────`,
	morning: `╭─ ☀️ *GOOD MORNING, {group}*
│
│ A fresh day is another chance to make useful progress.
│
│ 💡 *Alpha Insight of the Day*
│ “{quote}”
│
│ Have a focused and productive day.
╰──────────────────`,
	night: `╭─ 🌙 *GOOD NIGHT, {group}*
│
│ The day is done. Keep the lessons, leave the unnecessary stress behind, and recharge for tomorrow.
│
│ Rest well. ✨
╰──────────────────`,
	game: `╭─ 🎮 *ALPHA GAME ARENA*
│
│ Game: {game}
│ Player: {user}
│ Time: 60 seconds
│ Answer format: #{answer}
│
│ Scores and wins are recorded automatically.
╰──────────────────`,
	inactivity: `╭─ 📊 *ACTIVITY REVIEW*
│
│ Minimum target: {minimum} messages
│ Members below target: {count}
│
│ Review the list before removing anyone. New or temporarily-away members may naturally have lower counts.
╰──────────────────`,
	event: `╭─ 📅 *EVENT REMINDER*
│
│ {event}
│ Date: {date}
│
│ Please save the date and prepare where necessary.
╰──────────────────`,
	poll: `╭─ 🗳️ *QUICK POLL*
│
│ {question}
│
│ Vote once and Alpha will use the result where the feature supports it.
╰──────────────────`,
};

export const DAILY_INSIGHTS = [
	"Consistency makes ordinary effort compound into uncommon results.",
	"A clear priority is more useful than a long list of good intentions.",
	"Progress becomes easier to see when you measure what actually matters.",
	"Good teams do not avoid disagreement; they make disagreement productive.",
	"Small improvements repeated often usually beat rare bursts of motivation.",
	"The quality of your questions often determines the quality of your decisions.",
	"Attention is a resource; spend it where it can create something useful.",
	"A plan becomes valuable only when it changes what you do next.",
	"You do not need perfect conditions to make meaningful progress today.",
	"Reliability builds trust faster than impressive promises.",
	"Learning becomes powerful when you turn information into action.",
	"A difficult task becomes lighter when the next step is made obvious.",
	"Strong habits reduce the number of decisions that depend on motivation.",
	"Useful feedback is information for improvement, not a verdict on your ability.",
	"Protecting your time is one way of protecting your goals.",
	"The fastest route is not always the one with the fewest steps; it is the one with the least wasted effort.",
	"People remember how dependable you are long after they forget how busy you looked.",
	"A calm response can solve problems that a quick reaction makes worse.",
	"When priorities compete, choose the one with the greatest long-term consequence.",
	"Momentum grows when you finish important things instead of merely starting many things.",
	"A useful system keeps working on days when enthusiasm is low.",
	"Good communication removes uncertainty before it becomes conflict.",
	"Improvement starts when you can describe the real problem accurately.",
	"Being early with a small correction is cheaper than being late with a large rescue.",
	"Curiosity turns mistakes into data instead of dead ends.",
	"Your environment quietly shapes your habits, so design it with intention.",
	"The strongest shortcuts usually come from understanding the basics deeply.",
	"If a goal matters, give it a place on the calendar rather than only a place in your mind.",
	"Good judgment is knowing what deserves speed and what deserves patience.",
	"A group becomes stronger when members add value instead of only occupying space.",
	"End the day by noticing what worked; tomorrow can begin from evidence instead of guesswork.",
];

export const dailyInsightFor = (dateKey = new Date().toISOString().slice(0, 10)) => {
	let hash = 0;
	for (const ch of String(dateKey)) hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
	return DAILY_INSIGHTS[hash % DAILY_INSIGHTS.length];
};

export const renderGroupTemplate = (key, values = {}) => {
	let output = GROUP_TEMPLATES[key] || "";
	for (const [name, value] of Object.entries(values)) {
		output = output.replaceAll(`{${name}}`, String(value));
	}
	return output;
};
