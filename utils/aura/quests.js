import { key } from "./policy.js";
const BANK = [
  ["Which Linux command shows the current directory?", ["pwd", "ls", "cd"]],
  [
    "Which command lists files, including hidden files?",
    ["ls -a", "mkdir", "whoami"],
  ],
  [
    "What does HTTPS primarily protect while data travels?",
    [
      "Connection confidentiality and integrity",
      "Every file on your computer",
      "Your device from all malware",
    ],
  ],
  [
    "Which is the safest way to handle a suspicious login link?",
    [
      "Open the official service independently",
      "Enter your password to test it",
      "Forward it to everyone",
    ],
  ],
  [
    "What does RAM stand for?",
    ["Random Access Memory", "Remote Account Manager", "Read All Messages"],
  ],
  ["Which Linux command creates a directory?", ["mkdir", "rmdir", "cat"]],
  [
    "What is a strong additional login protection?",
    [
      "Multi-factor authentication",
      "Reusing your password",
      "Sharing a verification code",
    ],
  ],
  [
    "Which item should never be committed to a public repository?",
    ["A private API key", "A README", "An open-source licence"],
  ],
  [
    "What is the purpose of a backup?",
    [
      "Recovering data after loss",
      "Making passwords public",
      "Replacing all software updates",
    ],
  ],
  [
    "Which command displays your current Linux username?",
    ["whoami", "hostname", "touch"],
  ],
  ["Which protocol resolves domain names?", ["DNS", "SSH", "SMTP"]],
  ["Which command searches text using a pattern?", ["grep", "mv", "chmod"]],
];
export function learningQuest(actor, date, slot) {
  const hash = key(actor, date);
  const base = parseInt(hash.slice(0, 8), 16);
  const [prompt, choices] = BANK[(base + Number(slot) - 1) % BANK.length];
  const correct = parseInt(hash.slice(8, 10), 16) % 3,
    options = [...choices];
  [options[0], options[correct]] = [options[correct], options[0]];
  return { prompt, options, answer: correct + 1 };
}
