const RANK_FIXED = [
  { msgs: 0, name: "Unranked", emoji: "⚪" },
  { msgs: 100, name: "Bronze", emoji: "🥉" },
  { msgs: 1000, name: "Silver", emoji: "🥈" },
  { msgs: 10000, name: "Gold", emoji: "🥇" },
  { msgs: 50000, name: "Platinum", emoji: "💠" },
  { msgs: 100000, name: "Diamond", emoji: "💎" },
  { msgs: 200000, name: "Master", emoji: "🔱" },
  { msgs: 350000, name: "Grandmaster", emoji: "🏆" },
  { msgs: 500000, name: "Legendary", emoji: "👑" },
  { msgs: 1000000, name: "Alpha Elite", emoji: "🌟" },
];

// Legacy message ranks stay separate from Aura lifetime XP and seasonal RP.
const getRank = (n) => {
  const count = n || 0;
  return (
    [...RANK_FIXED].reverse().find((r) => count >= r.msgs) || RANK_FIXED[0]
  );
};

// Returns rank info on a rank-up threshold, or { congrats: true } every 10k after Diamond
const getRankUp = (n) => {
  const fixed = RANK_FIXED.find((r) => r.msgs === n && n > 0);
  if (fixed) return fixed;
  if (n > 100000 && (n - 100000) % 10000 === 0) return { congrats: true };
  return null;
};

export { RANK_FIXED, getRank, getRankUp };
