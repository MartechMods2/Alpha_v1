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
	welcome: { category: "community", title: "Welcome" },
	goodbye: { category: "community", title: "Goodbye" },
	rules: { category: "community", title: "Group Rules" },
	birthday: { category: "automation", title: "Birthday" },
	"birthday-confirmation": { category: "automation", title: "Birthday Confirmation" },
	warning: { category: "moderation", title: "Warning" },
	"final-warning": { category: "moderation", title: "Final Warning" },
	"anti-link": { category: "security", title: "Anti-Link Warning" },
	"anti-link-action": { category: "security", title: "Anti-Link Final Action" },
	"anti-status": { category: "security", title: "Anti-Status Warning" },
	"anti-status-final": { category: "security", title: "Anti-Status Final Strike" },
	"anti-spam": { category: "security", title: "Anti-Spam Warning" },
	muted: { category: "moderation", title: "Member Muted" },
	unmuted: { category: "moderation", title: "Member Unmuted" },
	removed: { category: "moderation", title: "Member Removed" },
	inactivity: { category: "activity", title: "Activity Review" },
	"inactivity-cleanup": { category: "activity", title: "Inactive Cleanup" },
	"group-locked": { category: "moderation", title: "Group Locked" },
	"group-reopened": { category: "moderation", title: "Group Reopened" },
	announcement: { category: "community", title: "Announcement" },
	morning: { category: "automation", title: "Good Morning" },
	night: { category: "automation", title: "Good Night" },
	game: { category: "games", title: "Game Start" },
	"game-result": { category: "games", title: "Game Result" },
	event: { category: "automation", title: "Event Reminder" },
	poll: { category: "community", title: "Poll" },
	"game-join": { category: "games", title: "Game Join Poll" },
	"count-report": { category: "activity", title: "Activity Report" },
	"kick-count-confirmation": { category: "activity", title: "Kick Review" },
	"mute-count-confirmation": { category: "activity", title: "Mute Review" },
	"security-alert": { category: "security", title: "Security Alert" },
	"member-cleared": { category: "moderation", title: "Member Cleared" },
});

export const GROUP_TEMPLATES = {
	welcome: `╭━━━〔 👋 *WELCOME* 〕━━━╮
Hello {user}! 🎉

Welcome to *{group}*. We’re happy to have you here.

📌 *Please take a moment to:*
• Read and understand the group rules.
• Respect every member and admin.
• Avoid spam, unnecessary links and repeated messages.
• Do not misuse WhatsApp Status mentions.
• Participate positively in conversations and activities.
• Feel free to introduce yourself to the group.

🛡️ *Admin Note:*
New members should understand the rules before participating fully. Admins can help if clarification is needed.

💡 Be active, be respectful and enjoy the community.
╰━━━〔 🤖 *ALPHA* 〕━━━╯`,
	goodbye: `╭━━━〔 👋 *GOODBYE* 〕━━━╮
{user} has left *{group}*.

Thank you for being part of the community. 💙
We appreciate the conversations, activities and moments shared with us.

We wish you success wherever you go next.

🛡️ *Admin Note:*
If the member left accidentally and wishes to return, they may contact an admin where appropriate. Avoid repeatedly re-adding anyone who intentionally leaves without first speaking with an admin.
╰━━━〔 🤖 *ALPHA* 〕━━━╯`,
	rules: `╭━━━〔 📜 *GROUP RULES* 〕━━━╮
Welcome to *{group}*.

1️⃣ Respect members and admins. No insults, bullying or unnecessary fights.
2️⃣ Avoid spam, repeated messages, excessive stickers or disruptive content.
3️⃣ Do not send suspicious, harmful or unauthorised links.
4️⃣ Do not misuse WhatsApp Status mentions.
5️⃣ Avoid inappropriate, offensive or disturbing content.
6️⃣ Do not impersonate another member, admin or Alpha.
7️⃣ Follow reasonable instructions from group admins.
8️⃣ Participate responsibly and contribute positively.

⚠️ Depending on the offence and group settings, repeated violations may lead to:
Warning → Mute → Removal.

🛡️ *For Admins:*
Use moderation actions fairly, review context before serious penalties, and do not abuse admin commands.

📌 Remaining in this group means you agree to respect these rules.
╰━━━〔 🤖 *ALPHA* 〕━━━╯`,
	birthday: `╭━━━〔 🎂 *HAPPY BIRTHDAY* 〕━━━╮
🎉 Happy Birthday, {user}! 🎉

Everyone in *{group}* wishes you a wonderful birthday filled with happiness, progress, good health and memorable moments. 🥳🎁

May this new year bring:
✨ Bigger opportunities
💙 Genuine happiness
🏆 Greater achievements
🙏 More reasons to be grateful
🚀 Progress in everything you do

Members, show our celebrant some love! 🎊

🛡️ *Admin Note:*
This greeting uses birthday information previously registered with Alpha.
╰━━━〔 🤖 *ALPHA* 〕━━━╯`,
	"birthday-confirmation": `╭━━━〔 🎂 *BIRTHDAY CHECK* 〕━━━╮
Hello {user} 👋

You are about to save your birthday with Alpha.
Please confirm that *{date}* is correct.

✅ *YES* — Save my birthday
❌ *NO* — Cancel the request

📌 Alpha will use the saved date to celebrate you automatically when your birthday arrives.

🛡️ *Admin Note:*
Members should only register their own birthday information.
╰━━━〔 🤖 *ALPHA* 〕━━━╯`,
	warning: `╭━━━〔 ⚠️ *MEMBER WARNING* 〕━━━╮
Attention {user},

Alpha recorded behaviour that may violate the rules of *{group}*.

📌 *Reason:* {reason}
⚠️ *Current Warning:* {warning}/{max}
{meter}

Please correct the behaviour and review the group rules before continuing.

Repeated violations may result in additional warnings, temporary mute, message deletion or removal.

🛡️ *Admin Note:*
Review repeated warnings before applying major manual penalties where context matters.

*Current action:* {action}
╰━━━〔 🤖 *ALPHA MODERATION* 〕━━━╯`,
	"final-warning": `╭━━━〔 🚨 *FINAL WARNING* 〕━━━╮
{user}, this is a serious moderation notice.

You have reached the configured warning limit in *{group}*.

📌 *Reason:* {reason}
⚠️ *Warnings:* {warning}/{max}
{meter}

Possible enforcement includes temporary mute, message deletion or removal depending on the configured policy.

🛡️ *Admin Note:*
Review the warning history before overriding Alpha’s moderation decision.

*Current action:* {action}
╰━━━〔 🤖 *ALPHA SECURITY* 〕━━━╯`,
	"anti-link": `╭━━━〔 🔗 *LINK WARNING* 〕━━━╮
Hello {user},

A link you posted in *{group}* triggered Alpha’s Anti-Link protection.

🚫 Unapproved links may expose members to:
• Spam or scams
• Phishing pages
• Unwanted promotions
• Unsafe downloads
• Unauthorised group invitations

⚠️ *Warning Count:* {warning}/{max}

📌 Ask an admin before posting promotional, invitation or unfamiliar links.

🛡️ *Admin Note:*
Whitelist trusted domains where appropriate instead of disabling Anti-Link protection completely.

*Current action:* {action}
╰━━━〔 🛡️ *ALPHA ANTI-LINK* 〕━━━╯`,
	"anti-link-action": `╭━━━〔 🚫 *ANTI-LINK ACTION* 〕━━━╮
{user} repeatedly triggered Anti-Link protection in *{group}*.

⚠️ *Warnings:* {warning}/{max}
The configured warning limit has been reached.

📌 Members are reminded not to keep sending unauthorised links after a warning.

🛡️ *Admin Note:*
Review allowed domains if legitimate links are being blocked frequently.

*Current action:* {action}
╰━━━〔 🛡️ *ALPHA SECURITY* 〕━━━╯`,
	"anti-status": `╭━━━〔 📵 *STATUS-MENTION WARNING* 〕━━━╮
Hello {user},

Alpha detected a restricted WhatsApp Status mention involving *{group}*.

⚠️ *Strike:* {warning}/{max}

Please avoid repeatedly mentioning the group or its members in Status updates without a valid reason.

This rule helps reduce unwanted notifications, spam and privacy problems.

🛡️ *Admin Note:*
Admins, protected accounts and Alpha are handled according to moderation exemptions.

*Current action:* {action}
╰━━━〔 📵 *ALPHA ANTI-STATUS* 〕━━━╯`,
	"anti-status-final": `╭━━━〔 ⛔ *STATUS LIMIT REACHED* 〕━━━╮
{user} has reached the Status-Mention strike limit in *{group}*.

⚠️ *Strikes:* {warning}/{max}

Previous warnings were issued, but the restricted behaviour continued.

🛡️ *Admin Note:*
If exceptional circumstances apply, review the strike history before taking further manual action.

*Current action:* {action}
╰━━━〔 🤖 *ALPHA SECURITY* 〕━━━╯`,
	"anti-spam": `╭━━━〔 🚨 *SPAM DETECTED* 〕━━━╮
Hello {user},

Alpha detected unusually frequent or repeated activity in *{group}*.

📌 *Reason:* {reason}
⚠️ *Warning:* {warning}/{max}

Spam may include sending many messages very quickly, repeating the same text, flooding the group with stickers/media, or deliberately disrupting conversation.

Please slow down. Continued spam may lead to stronger moderation.

🛡️ *Admin Note:*
If normal conversation is repeatedly detected as spam, review the Anti-Spam sensitivity settings.

*Current action:* {action}
╰━━━〔 🤖 *ALPHA ANTI-SPAM* 〕━━━╯`,
	muted: `╭━━━〔 🔇 *MEMBER MUTED* 〕━━━╮
{user} has been temporarily restricted in *{group}*.

⏱️ *Duration:* {duration}
📌 *Reason:* {reason}

While the mute is active, new messages from the member may be removed automatically.

🛡️ *For Admins:*
Review active restrictions and unmute the member when appropriate. A mute is intended to restore order without immediately removing the member.
╰━━━〔 🔇 *ALPHA MODERATION* 〕━━━╯`,
	unmuted: `╭━━━〔 🔊 *MUTE LIFTED* 〕━━━╮
Good news, {user}. ✅

Your mute in *{group}* has been removed and you may participate normally again.

📌 Please continue to follow the group rules and avoid repeating the behaviour that caused the restriction.

🛡️ *Admin Note:*
The member has regained normal messaging privileges.
╰━━━〔 🤖 *ALPHA* 〕━━━╯`,
	removed: `╭━━━〔 🚪 *MEMBER REMOVED* 〕━━━╮
{user} has been removed from *{group}* following a moderation action.

📌 *Reason:* {reason}

Members should avoid turning moderation actions into arguments in the group. Contact an admin privately if genuine clarification is needed.

🛡️ *Admins:*
Where appropriate, review warnings and moderation history before restoring a removed member.
╰━━━〔 🛡️ *ALPHA MODERATION* 〕━━━╯`,
	inactivity: `╭━━━〔 🪫 *ACTIVITY REVIEW* 〕━━━╮
Alpha completed an activity review for *{group}*.

👥 Members reviewed: {count}
📉 Below target: {minimum}

📌 *Members:*
Being active does not mean sending unnecessary messages. Meaningful participation is better than spam.

🛡️ *Admins:*
Activity reports are management aids. Review the list and Alpha’s tracking window before taking action, especially where a member has no reliable activity history.
╰━━━〔 📊 *ALPHA ACTIVITY* 〕━━━╯`,
	"inactivity-cleanup": `╭━━━〔 🧹 *INACTIVITY CLEANUP* 〕━━━╮
An inactivity cleanup is being reviewed for *{group}*.

Alpha identified *{count}* member(s) matching the selected rule.

🛡️ *Admins, before confirming:*
• Review every displayed member
• Check protected accounts and current admin roles
• Confirm the inactivity period
• Exclude members whose tracking history is uncertain

Alpha should only act on the reviewed snapshot after confirmation.
╰━━━〔 🤖 *ALPHA CLEANUP* 〕━━━╯`,
	"group-locked": `╭━━━〔 🔒 *GROUP TEMPORARILY LOCKED* 〕━━━╮
*{group}* has been placed in admin-only messaging mode.

This may be used for an important announcement, emergency moderation, an organised event or spam control.

📌 *Members:*
Normal messaging will return when an admin reopens the group.

🛡️ *Admins:*
Use group lock only when necessary and reopen the group when the reason ends.
╰━━━〔 🔒 *ALPHA GROUP CONTROL* 〕━━━╯`,
	"group-reopened": `╭━━━〔 🔓 *GROUP REOPENED* 〕━━━╮
Normal messaging has been restored in *{group}*. 🎉

All members may participate again.

📌 Please respect the rules, avoid spam, keep discussions constructive and follow reasonable admin instructions.

🛡️ *Admin Note:*
Admin-only posting mode has been disabled successfully.
╰━━━〔 🤖 *ALPHA* 〕━━━╯`,
	announcement: `╭━━━〔 📢 *IMPORTANT ANNOUNCEMENT* 〕━━━╮
Attention everyone in *{group}*.

{message}

📌 Please read the complete notice before asking questions that may already have been answered.

🛡️ *Admin Note:*
Keep announcements clear, accurate and relevant. Update members promptly if the information changes.
╰━━━〔 📢 *GROUP ADMINISTRATION* 〕━━━╯`,
	morning: `╭━━━〔 🌅 *GOOD MORNING* 〕━━━╮
Good morning, *{group}*! ☀️

A new day is another opportunity to learn, improve and make useful progress.

💡 *Alpha’s Thought:*
“{quote}”

Start today with a clear goal, positive energy, respect for others and something useful to accomplish.

Have a productive day everyone! 🚀
╰━━━〔 🤖 *ALPHA DAILY* 〕━━━╯`,
	night: `╭━━━〔 🌙 *GOOD NIGHT* 〕━━━╮
Good night, *{group}*. 🌙✨

Another day is ending. Take time to rest, recharge and prepare for tomorrow.

💡 *Alpha’s Thought:*
Rest is not wasted time. A clear mind performs better when it has had time to recover.

🙏 Appreciate today.
🧠 Learn from mistakes.
🎯 Prepare for tomorrow.
😴 Rest properly.
╰━━━〔 🤖 *ALPHA DAILY* 〕━━━╯`,
	game: `╭━━━〔 🎮 *GAME TIME* 〕━━━╮
Attention *{group}*! 🎉

🎯 *Game:* {game}
👤 *Player:* {user}
⏱️ *Time:* {time}
✍️ *Answer format:* {answer}

📌 Follow Alpha’s answer format, respect the timer, avoid random-answer spam and keep the competition friendly.

🛡️ *Admin Note:*
Games are for engagement. Stop or change a game if it begins disrupting normal group activity.
╰━━━〔 🎮 *ALPHA GAMES* 〕━━━╯`,
	"game-result": `╭━━━〔 🏆 *GAME COMPLETE* 〕━━━╮
Great game, *{group}*! 🎉

🏆 *Winner:* {winner}
📊 *Score:* {score}

Alpha has recorded the result for the completed session.

👏 Congratulations to the winner and everyone who participated. Friendly participation matters as much as winning.
╰━━━〔 🏆 *ALPHA GAMES* 〕━━━╯`,
	event: `╭━━━〔 📅 *GROUP EVENT* 〕━━━╮
Hello *{group}*! 👋

📌 *Event:* {event}
🗓️ *Date:* {date}
⏳ *When:* {when}

Members should note the details, follow participation instructions and ask an admin only where clarification is genuinely needed.

🛡️ *Admin Note:*
Update the group promptly if the event date, requirements or status changes.
╰━━━〔 📅 *ALPHA EVENTS* 〕━━━╯`,
	poll: `╭━━━〔 📊 *GROUP POLL* 〕━━━╮
A new poll is available in *{group}*.

❓ *Question:* {question}

Vote based on your genuine preference, avoid pressuring others and respect the final result.

🛡️ *Admin Note:*
Use polls for clear decisions, feedback, game participation or community planning.
╰━━━〔 📊 *ALPHA POLLS* 〕━━━╯`,
	"game-join": `╭━━━〔 🗳️ *WHO WANTS TO PLAY?* 〕━━━╮
Alpha is preparing the next game in *{group}*. 🎮

✅ *Join Game* — Include me
⏭️ *Sit This One Out* — I’ll watch this round

Only members who choose *Join Game* will be included in the active player list.

🛡️ *Admin Note:*
The opt-in poll keeps games voluntary and prevents Alpha from forcing inactive members into turns.
╰━━━〔 🎮 *ALPHA GAMES* 〕━━━╯`,
	"count-report": `╭━━━〔 📊 *GROUP ACTIVITY REPORT* 〕━━━╮
Alpha analysed the current activity records for *{group}*.

👥 Members reviewed: {count}
📉 Below target: {minimum}

📌 *Members:*
Do not send unnecessary messages simply to increase your count.

🛡️ *Admins:*
Use activity statistics as a management aid rather than the only reason for punishment. Review the exact displayed set before any confirmed mute or removal.
╰━━━〔 📊 *ALPHA ACTIVITY* 〕━━━╯`,
	"kick-count-confirmation": `╭━━━〔 ⚠️ *REMOVAL CONFIRMATION* 〕━━━╮
You are about to remove *{count}* member(s) from the most recent Alpha activity review in *{group}*.

⚠️ This is a destructive action.

Before confirming, verify the report, target members and protected accounts. Alpha should refresh the live group roster and re-check admin/owner status before removal.
╰━━━〔 🚨 *CONFIRM CAREFULLY* 〕━━━╯`,
	"mute-count-confirmation": `╭━━━〔 🔇 *BULK MUTE REVIEW* 〕━━━╮
You are preparing to mute *{count}* member(s) from the latest Alpha activity review in *{group}*.

⏱️ *Duration:* {duration}

🛡️ *Admins:*
Review the selected member list, duration, protected accounts and whether a mute is more appropriate than removal.

No mute should be applied until confirmation is completed.
╰━━━〔 🤖 *ALPHA MODERATION* 〕━━━╯`,
	"security-alert": `╭━━━〔 🛡️ *SECURITY ALERT* 〕━━━╮
Alpha detected activity that may require admin attention in *{group}*.

📌 *Reason:* {reason}

Members should avoid interacting with suspicious content until it has been reviewed.

🛡️ *Admin Action:*
Review the triggering message or member before applying additional manual enforcement.
╰━━━〔 🛡️ *ALPHA SECURITY* 〕━━━╯`,
	"member-cleared": `╭━━━〔 ✅ *REVIEW COMPLETE* 〕━━━╮
The moderation review involving {user} in *{group}* has been completed.

No further action is currently required.

🛡️ *Admin Note:*
If a warning or restriction was issued incorrectly, clear the relevant moderation record where supported.
╰━━━〔 🤖 *ALPHA MODERATION* 〕━━━╯`,
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
	"Good communication removes uncertainty before it becomes conflict.",
	"Improvement starts when you can describe the real problem accurately.",
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
		output = output.replaceAll(`{${name}}`, String(value ?? ""));
	}
	return output;
};

export const groupTemplatePlaceholders = (key) => [
	...new Set((GROUP_TEMPLATES[key]?.match(/\{[a-zA-Z0-9_-]+\}/g) || []).map((value) => value.slice(1, -1))),
];
