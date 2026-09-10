export type BadgeCategory =
  | "welcome"
  | "games"
  | "words"
  | "score"
  | "length"
  | "special";

export type BadgeDef = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: BadgeCategory;
};

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  welcome: "Premiers pas",
  games: "Parties jouées",
  words: "Mots trouvés",
  score: "Points",
  length: "Mots longs",
  special: "Exploits",
};

export const GAME_THRESHOLDS = [1, 10, 50, 100, 300, 500, 1000] as const;
export const ROUND_WORD_THRESHOLDS = [10, 20, 30, 40, 50, 75, 100] as const;
export const ROUND_SCORE_THRESHOLDS = [10, 20, 30, 40, 50, 75, 100, 150, 200] as const;
export const WORD_LENGTH_THRESHOLDS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
export const LIFETIME_WORD_THRESHOLDS = [50, 100, 250, 500, 1000, 2500, 5000] as const;
export const WIN_THRESHOLDS = [1, 10, 25, 50, 100] as const;
export const COLLECTION_THRESHOLDS = [10, 25, 50] as const;

const GAME_TITLES: Record<number, string> = {
  1: "Première table",
  10: "Habitué",
  50: "Fidèle",
  100: "Centenaire",
  300: "Pilier",
  500: "Légende",
  1000: "Immortel",
};

const GAME_ICONS: Record<number, string> = {
  1: "🎲",
  10: "☕",
  50: "🫶",
  100: "💯",
  300: "🏛️",
  500: "🦄",
  1000: "♾️",
};

const WORD_ROUND_TITLES: Record<number, string> = {
  10: "Moissonneur",
  20: "Filet plein",
  30: "Vocabulaire",
  40: "Dictionnaire vivant",
  50: "Machine à mots",
  75: "Tempête de lettres",
  100: "Cent mots",
};

const WORD_ROUND_ICONS: Record<number, string> = {
  10: "🌾",
  20: "🕸️",
  30: "🗣️",
  40: "📕",
  50: "⚙️",
  75: "🌪️",
  100: "🔠",
};

const LIFETIME_WORD_ICONS: Record<number, string> = {
  50: "🌱",
  100: "🌿",
  250: "🌳",
  500: "📚",
  1000: "💎",
  2500: "💍",
  5000: "🌌",
};

const SCORE_TITLES: Record<number, string> = {
  10: "Premiers points",
  20: "En rythme",
  30: "Marqueur",
  40: "Tableau noir",
  50: "Demi-cent",
  75: "Gros score",
  100: "Centurion",
  150: "Rafale",
  200: "Explosion",
};

const SCORE_ICONS: Record<number, string> = {
  10: "⭐",
  20: "🎵",
  30: "🖊️",
  40: "🧮",
  50: "🌓",
  75: "🔥",
  100: "🛡️",
  150: "⚡",
  200: "💥",
};

const LENGTH_TITLES: Record<number, string> = {
  5: "Pentagone",
  6: "Hexamètre",
  7: "Heptathlon",
  8: "Octave",
  9: "Neuf vies",
  10: "Dizain",
  11: "Onze de rêve",
  12: "Douzaine",
  13: "Chanceux",
  14: "Architecte",
  15: "Mammouth",
  16: "Le mot ultime",
};

const LENGTH_ICONS: Record<number, string> = {
  5: "🔶",
  6: "🐝",
  7: "🎽",
  8: "🎹",
  9: "🐈",
  10: "🔟",
  11: "🌙",
  12: "🥚",
  13: "🍀",
  14: "🏗️",
  15: "🦣",
  16: "🏔️",
};

const WIN_ICONS: Record<number, string> = {
  1: "🥇",
  10: "🎖️",
  25: "🏆",
  50: "👑",
  100: "🦁",
};

const COLLECTION_ICONS: Record<number, string> = {
  10: "🎒",
  25: "🗃️",
  50: "🏺",
};

function tier(
  id: string,
  title: string,
  description: string,
  icon: string,
  category: BadgeCategory,
): BadgeDef {
  return { id, title, description, icon, category };
}

export const BADGES: BadgeDef[] = [
  tier("welcome", "Bienvenue", "Tu as créé ton compte Lexo.", "👋", "welcome"),
  tier("premier-mot", "Premier mot", "Tu as validé ton premier mot.", "✨", "welcome"),
  tier("premier-solo", "Solitaire", "Tu as terminé une partie en solitaire.", "🃏", "welcome"),
  tier("premier-multi", "Autour de la table", "Tu as joué une partie à plusieurs.", "🤝", "welcome"),

  ...GAME_THRESHOLDS.map((n) =>
    tier(
      `parties-${n}`,
      GAME_TITLES[n] ?? `${n} parties`,
      n === 1 ? "Tu as terminé ta première partie." : `Tu as joué ${n} parties.`,
      GAME_ICONS[n] ?? "🎲",
      "games",
    ),
  ),

  ...ROUND_WORD_THRESHOLDS.map((n) =>
    tier(
      `manche-mots-${n}`,
      WORD_ROUND_TITLES[n] ?? `${n} mots`,
      `Tu as trouvé ${n} mots dans une même manche.`,
      WORD_ROUND_ICONS[n] ?? "🔤",
      "words",
    ),
  ),

  ...LIFETIME_WORD_THRESHOLDS.map((n) =>
    tier(
      `mots-${n}`,
      n >= 1000 ? `${n} mots` : `Collection ${n}`,
      `Tu as trouvé ${n} mots au total.`,
      LIFETIME_WORD_ICONS[n] ?? "📖",
      "words",
    ),
  ),

  ...ROUND_SCORE_THRESHOLDS.map((n) =>
    tier(
      `manche-pts-${n}`,
      SCORE_TITLES[n] ?? `${n} points`,
      `Tu as marqué ${n} points dans une manche.`,
      SCORE_ICONS[n] ?? "⭐",
      "score",
    ),
  ),

  ...WORD_LENGTH_THRESHOLDS.map((n) =>
    tier(
      `mot-${n}`,
      LENGTH_TITLES[n] ?? `Mot de ${n}`,
      `Tu as trouvé un mot de ${n} lettres.`,
      LENGTH_ICONS[n] ?? "📏",
      "length",
    ),
  ),

  ...WIN_THRESHOLDS.map((n) =>
    tier(
      `victoire-${n}`,
      n === 1 ? "Première victoire" : `${n} victoires`,
      n === 1 ? "Tu as fini premier d’une partie." : `Tu as remporté ${n} parties.`,
      WIN_ICONS[n] ?? "🏅",
      "special",
    ),
  ),

  tier("partage", "Mot en commun", "Tu as trouvé un mot en même temps qu’un autre joueur.", "🔗", "special"),
  tier("lexicographe", "Lexicographe", "Tu as ajouté un mot au dictionnaire.", "✒️", "special"),
  tier("mains-vides", "Blanc comme neige", "Une manche sans aucun mot. Ça arrive.", "🕊️", "special"),
  tier("qu-maitre", "Maître du Qu", "Tu as trouvé un mot avec Qu.", "🧩", "special"),
  tier("unique-15", "Territoire", "15 mots uniques (non partagés) dans une manche.", "🗺️", "special"),
  tier("marathon-5", "Marathon", "5 manches d’affilée dans la même partie.", "🏃", "special"),
  tier("hote-10", "Hôte généreux", "Tu as lancé 10 parties.", "🛎️", "special"),
  ...COLLECTION_THRESHOLDS.map((n) =>
    tier(
      `collection-${n}`,
      n === 50 ? "Cabinet de curiosités" : `Collectionneur ${n}`,
      `Tu as débloqué ${n} badges.`,
      COLLECTION_ICONS[n] ?? "🎒",
      "special",
    ),
  ),
];

export const BADGE_BY_ID = new Map(BADGES.map((badge) => [badge.id, badge]));

export function badgePublic(id: string): BadgeDef | undefined {
  return BADGE_BY_ID.get(id);
}

export type BadgeUnlock = BadgeDef & { earnedAt: number };

export type BadgeView = BadgeDef & {
  earned: boolean;
  earnedAt: number | null;
};
