export const TEXT_LAB_COMMANDS = Object.freeze([
	"uppercase", "lowercase", "titlecase", "reverse", "wordcount", "charcount", "readingtime", "slugify",
	"base64encode", "base64decode", "urlencode", "urldecode", "sha256", "sortlines", "uniquelines",
	"shufflewords", "numberlist", "uuid", "password", "timestamp", "hexrgb", "rgbhex", "roman", "fromroman",
	"binary", "decimal", "morse", "unmorse", "unitconvert",
]);

export const COMMUNITY_COMMANDS = Object.freeze([
	"communityhelp", "mybio", "nickname", "reputation", "giverep", "repboard", "suggest", "suggestions",
	"confess", "confessions", "lost", "market", "ticket", "mytickets", "reportmember", "faq", "checkin",
	"attendance", "rsvp", "rsvplist", "standup", "standups",
]);

export const PRODUCTIVITY_COMMANDS = Object.freeze([
	"productivityhelp", "habit", "habits", "goal", "goals", "deadline", "deadlines", "flashcard", "flashcards",
	"studyroom", "pomodoro", "pomodorostop", "expensesplit", "tipcalc", "percentage", "datecalc", "randompick",
]);

export const ARCADE_COMMANDS = Object.freeze([
	"arcadehelp", "hangman", "guess", "wordchain", "word", "anagram", "unscramble", "mathrace", "mathanswer",
	"cryptogram", "cryptoanswer", "sequencequiz", "sequenceanswer", "wordclue", "clueanswer", "cardguess", "cardanswer",
	"capitalquiz", "capitalanswer", "storychain", "bingostart", "bingocard", "bingocall", "bingo", "quickdraw", "quicktap",
]);

export const ENHANCEMENT_ADMIN_COMMANDS = Object.freeze([
	"suggestionqueue", "suggestionreview", "confessionqueue", "confessionreview", "reportqueue", "resolvereport",
	"ticketadmin", "faqadmin", "marketadmin", "autoreply", "roleadmin", "roles", "attendanceadmin", "standupadmin",
	"nicknameadmin", "communitystats", "enhancementreset",
]);

export const ULTIMATE_FEATURE_COMMANDS = Object.freeze([
	...TEXT_LAB_COMMANDS,
	...COMMUNITY_COMMANDS,
	...PRODUCTIVITY_COMMANDS,
	...ARCADE_COMMANDS,
	...ENHANCEMENT_ADMIN_COMMANDS,
]);
