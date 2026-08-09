import { todayISO } from "./utils.js";

// Ilustracje (ilustracja -> emoji)
export const ILLUSTRATIONS = {
  pregnancy: "🤰",
  balloon: "🎈",
  bloom: "🌸",
  breasts: "🫶",
  calendar: "📅",
  cramps: "😣",
  discharge: "💧",
  egg: "🥚",
  food: "🥗",
  heavy: "🩸",
  hygiene: "🧼",
  libido: "💞",
  mind: "🧠",
  moon: "🌙",
  ovulation: "🎯",
  pain: "💢",
  period: "🩸",
  phases: "🔄",
  pms: "🌩️",
  products: "🧴",
  skin: "✨",
  sleepy: "🥱",
  sparkle: "🌟",
  sport: "🤸",
  spotting: "🌹",
  stress: "🌪️",
  sweets: "🍫",
  talk: "💬",
  test: "🧪",
  training: "🏃‍♀️",
};

// Tony kolorystyczne (pastelowe gradienty kart + akcent)
export const TONES = {
  rose: { g: "linear-gradient(135deg, #FFE3EC 0%, #F7C8D9 100%)", strong: "#E65C88" },
  pink: { g: "linear-gradient(135deg, #FFD6E8 0%, #F2A6C6 100%)", strong: "#D94D79" },
  lilac: { g: "linear-gradient(135deg, #F0E1FB 0%, #D9BCF2 100%)", strong: "#B66BC4" },
  blue: { g: "linear-gradient(135deg, #DFF0FD 0%, #BFDFF7 100%)", strong: "#5B9BD5" },
  peach: { g: "linear-gradient(135deg, #FFE8D9 0%, #FBCDB0 100%)", strong: "#F0905C" },
  mint: { g: "linear-gradient(135deg, #DDF5EC 0%, #BCE8D6 100%)", strong: "#4CAF8B" },
  cream: { g: "linear-gradient(135deg, #FBF3E0 0%, #F5E3BE 100%)", strong: "#D9A94A" },
};

// Kolejność i metadane kategorii
export const CATEGORY_META = [
  { key: "Zdrowie reprodukcyjne", emoji: "🩺", tagline: "Ciało, objawy i codzienne pytania" },
  { key: "Seks i intymność", emoji: "💞", tagline: "Libido, komfort i rozmowy" },
  { key: "Podczas okresu", emoji: "🩸", tagline: "Ból, obfitość i pielęgnacja" },
  { key: "Poznaj swój cykl", emoji: "🌸", tagline: "Fazy, owulacja i obserwacja" },
  { key: "Ciało i samopoczucie", emoji: "🧘‍♀️", tagline: "PMS, skóra, energia i nastrój" },
];

export const CATEGORY_ORDER = CATEGORY_META.map((c) => c.key);

export function categoryMeta(key) {
  return CATEGORY_META.find((c) => c.key === key) || { emoji: "📖", tagline: "" };
}

export function emojiFor(article) {
  return ILLUSTRATIONS[article.illustration] || "🌸";
}

export function toneFor(article) {
  return TONES[article.tone] || TONES.rose;
}

// Faza cyklu użytkowniczki na podstawie kalendarza (bez podawania pewników)
export function currentPhase(calData) {
  if (!calData) return null;
  const today = todayISO();
  const type = calData.days?.[today] || "normal";
  if (type === "period") return "period";
  if (type === "ovulation" || type === "fertile") return "ovulation";
  const pred = calData.prediction || {};
  if (pred.ovulation_date) {
    if (today < pred.ovulation_date) return "follicular";
    if (today > pred.ovulation_date) return "luteal";
  }
  return null;
}

export const PHASE_INFO = {
  period: {
    emoji: "🩸",
    name: "W trakcie okresu",
    headline: "Materiały na trudniejsze dni",
    desc: "Jak złagodzić ból, dobrać produkty i zadbać o siebie podczas okresu.",
  },
  ovulation: {
    emoji: "🥚",
    name: "W oknie płodnym",
    headline: "Wszystko o owulacji",
    desc: "Rozpoznawanie płodności, śluz, testy i odczucia z tym związane.",
  },
  follicular: {
    emoji: "🌱",
    name: "Po okresie — energia rośnie",
    headline: "Poznaj swój cykl",
    desc: "Fazy cyklu, obserwacja i dopasowanie treningu do dnia.",
  },
  luteal: {
    emoji: "🌙",
    name: "Przed okresem",
    headline: "Łagodzenie PMS",
    desc: "Jak złagodzić PMS, wzdęcia, zmęczenie i wahania nastroju.",
  },
};

const PHASE_PRIORITY = {
  period: ["period"],
  ovulation: ["ovulation", "any"],
  follicular: ["any", "ovulation"],
  luteal: ["pre_period", "luteal", "any"],
};

// Rekomendacje „Dla Ciebie” (maks. 6 kart)
export function recommendedArticles(articles, calData) {
  const phase = currentPhase(calData);
  if (!phase) return articles.slice(0, 6);
  const wanted = PHASE_PRIORITY[phase] || ["any"];
  const pool = [...articles].sort((a, b) => {
    const ra = wanted.indexOf(a.phase) === -1 ? 99 : wanted.indexOf(a.phase);
    const rb = wanted.indexOf(b.phase) === -1 ? 99 : wanted.indexOf(b.phase);
    return ra - rb;
  });
  return pool.slice(0, 6);
}

export function filterArticles(articles, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return articles;
  return articles.filter((a) => {
    const hay = `${a.title} ${a.summary} ${a.keywords || ""}`.toLowerCase();
    return hay.includes(q);
  });
}
