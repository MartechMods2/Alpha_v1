const PROMPTS = {
  classic: {
    truth: [
      "What is one thing you have changed your mind about recently?",
      "What harmless habit would your friends tease you about?",
      "What is one goal you are quietly serious about right now?",
      "What is something you are better at than most people here probably know?",
      "What is one compliment you still remember clearly?",
      "What is a small decision you made that improved your life?",
      "What is something you used to be afraid of that now feels easy?",
      "What is the funniest misunderstanding you have ever had?",
      "What is one thing you wish you had learned earlier?",
      "What is a harmless opinion you will defend forever?",
      "What is one thing you have procrastinated on for too long?",
      "What is a recent moment that made you genuinely proud of yourself?"
    ],
    dare: [
      "Describe your current mood as a movie title.",
      "Send a seven-word motivational speech to the group.",
      "Give the next person who chats a sincere compliment.",
      "Explain your favourite food like a football commentator.",
      "Send a voice note saying a tongue twister twice without slowing down.",
      "Write a four-line poem using the words group, energy and weekend.",
      "Describe your day using exactly four emojis and let the group guess it.",
      "Invent a harmless superhero name for yourself and explain the power.",
      "Create a funny but respectful slogan for this group in under ten words.",
      "Describe your favourite snack without naming it and let the group guess.",
      "Write a one-sentence acceptance speech for winning Member of the Day.",
      "Pretend you are a weather reporter and describe the group's current mood."
    ]
  },
  funny: {
    truth: [
      "What is the most unnecessary thing you have ever spent money on?",
      "What is your funniest autocorrect or typo story?",
      "What food combination do you enjoy that other people might question?",
      "What is the silliest excuse you have ever used to avoid something?",
      "Which app do you open far more often than you should?",
      "What is the weirdest thing you have searched online recently?",
      "What is one thing you confidently did wrong for years before someone corrected you?",
      "What is your most dramatic reaction to a very small problem?",
      "What is the funniest nickname you have ever had?",
      "Which chore makes you behave like you are being personally attacked?",
      "What harmless thing makes you irrationally competitive?",
      "What is the funniest lie you believed as a child?"
    ],
    dare: [
      "Explain your last meal like it is the trailer for an action movie.",
      "Describe this group as if you are selling it in a luxury advert.",
      "Write a dramatic apology to your phone battery.",
      "Give yourself a ridiculous professional title and explain your job.",
      "Send a voice note saying 'Alpha runs this place' like a movie villain.",
      "Describe your week using only three song titles.",
      "Write a breaking-news headline about your current situation.",
      "Invent a fake product nobody asked for and pitch it in one sentence.",
      "Describe the person who messaged before you as a fictional superhero, respectfully.",
      "Type a one-line campaign speech for becoming group president.",
      "Turn your last minor inconvenience into a dramatic Nollywood title.",
      "Describe your mood as if it were a software error message."
    ]
  },
  deep: {
    truth: [
      "What is one lesson you learned the hard way but now value?",
      "What quality do you most want to strengthen in yourself?",
      "What is something you are still learning to be patient about?",
      "What does success mean to you right now?",
      "What is one boundary you have become better at protecting?",
      "What is a decision you are glad your past self made?",
      "What is one fear that has influenced more decisions than you would like?",
      "What is something you wish people understood about you without you having to explain it?",
      "What is one mistake that taught you something useful?",
      "What kind of person do you want people to remember you as?",
      "What is something you need more courage to do?",
      "What is one thing you are grateful you did not give up on?"
    ],
    dare: [
      "Write one sincere sentence encouraging your future self.",
      "Share one practical lesson you would give your younger self.",
      "Name one goal you want to make measurable this month.",
      "Give someone in the group a genuine compliment about their character.",
      "Write one sentence describing what peace means to you.",
      "Share one small habit you want to improve this week.",
      "Write a short note thanking someone who has helped you grow, without naming private details.",
      "State one thing you are proud of without downplaying it.",
      "Share one positive belief you want to carry into the next month.",
      "Write one sentence about something you want to forgive yourself for, only if you are comfortable.",
      "Name one skill you want to build and the first tiny step you can take.",
      "Write a one-line reminder you would like to see on a difficult day."
    ]
  },
  friendship: {
    truth: [
      "What makes you trust someone quickly?",
      "What quality do you value most in a close friend?",
      "What small gesture makes you feel appreciated?",
      "What is one friendship lesson you have learned over time?",
      "What kind of support do you appreciate most when you are stressed?",
      "What is something a friend once did that you still remember warmly?",
      "What makes someone easy for you to talk to?",
      "What is one thing you think every strong friendship needs?",
      "Are you more likely to call, text or visit when checking on a friend?",
      "What is one sign that tells you someone is a genuine friend?",
      "What kind of group activity makes you feel closest to people?",
      "What is one thing you try to do well as a friend?"
    ],
    dare: [
      "Give one sincere compliment to someone currently active in the group.",
      "Write a two-line appreciation message for the group.",
      "Tag one player and say one positive thing you have noticed about them.",
      "Describe the perfect low-budget hangout with friends in one sentence.",
      "Create a friendship motto for this group.",
      "Share one song title that reminds you of good friendship energy.",
      "Write a one-line thank-you note to a friend without naming them.",
      "Describe your ideal group trip using five words.",
      "Suggest one fun activity this group could actually do together.",
      "Give the current player after you a positive nickname.",
      "Write a short toast to good friendships.",
      "Describe this group using three positive adjectives."
    ]
  },
  tech: {
    truth: [
      "What technology do you use every day but barely understand?",
      "What is the most frustrating bug you have ever dealt with?",
      "What app feature do you wish existed?",
      "What was the first device that made you interested in technology?",
      "What tech skill would you learn instantly if you could?",
      "What is one project idea you keep postponing?",
      "Which piece of software do you complain about but still keep using?",
      "What is the most embarrassing tech mistake you have made?",
      "What kind of product would you love to build someday?",
      "What is one repetitive task you wish you could automate?",
      "Which is harder for you: starting a project or finishing it?",
      "What is one piece of technology you think is overrated?"
    ],
    dare: [
      "Explain your current mood as a Git commit message.",
      "Describe your love life as a harmless software bug report.",
      "Pitch a ridiculous app idea in one sentence.",
      "Write pseudo-code for surviving Monday morning.",
      "Rename yourself as a software version for the next message.",
      "Describe this group as if it were a startup product.",
      "Write a fake terminal command that fixes procrastination.",
      "Invent a harmless AI feature Alpha should definitely never need.",
      "Explain your favourite food using programming terminology.",
      "Give your week a software release name and version number.",
      "Write one line of fake code that describes your personality.",
      "Describe the group's energy as if it were server status."
    ]
  }
};

const REACTIONS = {
  truth: [
    "🎯 Truth selected. Brave choice.",
    "👀 Truth it is. Alpha is listening.",
    "🎯 Straight into the honesty zone.",
    "🌚 Truth selected. No pressure, but the group is watching.",
    "🧠 Truth mode activated."
  ],
  dare: [
    "🔥 Dare selected. Things just got interesting.",
    "😮‍💨 Dare mode activated.",
    "🔥 Bold choice. Alpha approves the courage.",
    "😂 Dare selected. This should be good.",
    "⚡ No hesitation—Dare it is."
  ],
  skip: [
    "⏭️ Skip accepted. No explanations needed.",
    "🫡 Skip registered. Moving cleanly to the next turn.",
    "⏭️ No pressure. Alpha is moving on.",
    "✅ Skip accepted without penalty beyond this turn's points."
  ],
  complete: [
    "✅ Turn completed.",
    "🔥 Completed. Respect.",
    "⚡ Done and counted.",
    "😂 Somehow survived that one.",
    "✅ Alpha has locked in the points."
  ],
  timeout: [
    "⌛ Time expired. Alpha is moving on.",
    "⏱️ Turn timed out. No stress—next player.",
    "⌛ No response in time. Alpha keeps the game moving."
  ],
  next: [
    "👀 Next player, you're up.",
    "⚡ Alpha is moving to the next turn.",
    "🎭 New turn loading.",
    "🔥 Next player—your fate awaits."
  ]
};

const ALL_THEMES = Object.keys(PROMPTS);
const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

export const truthDareThemes = Object.freeze([...ALL_THEMES, "random"]);

export const normalizeTruthDareTheme = (value = "classic") => {
  const theme = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  return truthDareThemes.includes(theme) ? theme : "classic";
};

export const buildTruthDareDeck = ({ theme = "classic", type = "truth", seed = Math.random } = {}) => {
  const safeType = type === "dare" ? "dare" : "truth";
  const selectedTheme = normalizeTruthDareTheme(theme);
  const source = selectedTheme === "random"
    ? ALL_THEMES.flatMap((name) => PROMPTS[name][safeType])
    : [...PROMPTS.classic[safeType], ...(selectedTheme === "classic" ? [] : PROMPTS[selectedTheme][safeType])];

  const deck = [...new Set(source)];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seed() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

export const truthDareReaction = (type) => randomItem(REACTIONS[type] || REACTIONS.next);

export const truthDarePromptCount = () =>
  Object.values(PROMPTS).reduce((sum, theme) => sum + theme.truth.length + theme.dare.length, 0);
