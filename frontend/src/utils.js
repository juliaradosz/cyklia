export function iso(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return iso(new Date());
}

export function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function daysBetween(a, b) {
  const A = parseISO(a);
  const B = parseISO(b);
  return Math.round((B - A) / 86400000);
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPL(s) {
  const d = parseISO(s);
  const days = [
    "niedziela", "poniedziałek", "wtorek", "środa",
    "czwartek", "piątek", "sobota",
  ];
  const months = [
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export function shortPL(s) {
  const d = parseISO(s);
  const months = [
    "sty", "lut", "mar", "kwi", "maj", "cze",
    "lip", "sie", "wrz", "paź", "lis", "gru",
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function dayMonthPL(s) {
  const d = parseISO(s);
  const months = [
    "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function weekOf(s) {
  const d = parseISO(s);
  const dow = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    out.push(iso(dd));
  }
  return out;
}

export const WEEK_LETTERS = ["p", "w", "ś", "c", "p", "s", "n"];

export const MOODS = [
  { key: "radosna", emoji: "😊", label: "Radosna" },
  { key: "spokojna", emoji: "😌", label: "Spokojna" },
  { key: "neutralna", emoji: "😐", label: "Neutralna" },
  { key: "pobudzona", emoji: "🤩", label: "Pobudzona" },
  { key: "energiczna", emoji: "⚡", label: "Energiczna" },
  { key: "zakochana", emoji: "😍", label: "Zakochana" },
  { key: "zrelaksowana", emoji: "🧘‍♀️", label: "Zrelaksowana" },
  { key: "towarzyska", emoji: "🥳", label: "Towarzyska" },
  { key: "wdzięczna", emoji: "😇", label: "Wdzięczna" },
  { key: "zmęczona", emoji: "🥱", label: "Zmęczona" },
  { key: "znudzona", emoji: "😑", label: "Znudzona" },
  { key: "smutna", emoji: "😢", label: "Smutna" },
  { key: "przygnębiona", emoji: "😔", label: "Przygnębiona" },
  { key: "drażliwa", emoji: "😠", label: "Drażliwa" },
  { key: "zła", emoji: "😤", label: "Zła" },
  { key: "lękowa", emoji: "😰", label: "Lękowa" },
  { key: "spięta", emoji: "😬", label: "Spięta" },
  { key: "płaczliwa", emoji: "😭", label: "Płaczliwa" },
  { key: "bezsilna", emoji: "😩", label: "Bezsilna" },
];

export const SYMPTOMS = [
  "Ból brzucha",
  "Ból pleców",
  "Ból piersi",
  "Ból głowy",
  "Ból jajników",
  "Wzdęcia",
  "Mdłości",
  "Trądzik",
  "Sucha skóra",
  "Zwiększony apetyt",
  "Brak apetytu",
  "Zachcianki na słodkie",
  "Zgaga",
  "Zaparcia",
  "Biegunka",
  "Zawroty głowy",
  "Kurcze nóg",
  "Wrażliwość na światło",
  "Trudności z koncentracją",
  "Niepokój",
  "Płaczliwość",
  "Bóle mięśni",
  "Opuchnięte piersi",
];

export const LIBIDO = ["Niskie", "Średnie", "Wysokie"];

export const BLEEDING = ["Skąpe", "Średnio obfite", "Skrzepy"];

export const DIGESTIVE = ["Mdłości", "Wzdęcia", "Zaparcia", "Biegunka"];

export const SEX_ACT = [
  "Dzień bez seksu",
  "Seks z zabezpieczeniem",
  "Seks bez zabezpieczenia",
  "Seks oralny",
  "Seks analny",
  "Masturbacja",
  "Pieszczoty",
  "Gadżety erotyczne",
  "Orgazm",
];

export const MUCUS = [
  "Brak",
  "Kremowa",
  "Wodnista",
  "Lepka",
  "Jak białko jajka",
  "Plamienia",
  "Nietypowa",
  "Biała i grudkowata",
  "Szara",
];

export const PHASE_HINTS = {
  period: {
    icon: "droplet",
    title: "Okres",
    text: "To naturalna część cyklu. Organizm może być zmęczony — daj sobie więcej odpoczynku i ciepła.",
    items: ["Ból brzucha", "Zmęczenie", "Wahania nastroju", "Wzdęcia", "Ból piersi"],
  },
  follicular: {
    icon: "flower",
    title: "Faza folikularna",
    text: "Po okresie energia wraca — dobry czas na działanie, sport i nowe plany.",
    items: ["Wzrost energii", "Lepsze samopoczucie", "Jaśniejsza skóra"],
  },
  ovulation: {
    icon: "sparkles",
    title: "Owulacja",
    text: "Płodność jest najwyższa — możesz zauważyć wzrost libido i śluz jak białko jajka.",
    items: ["Wzrost libido", "Śluz jak białko jajka", "Lekki ból jajnika"],
  },
  fertile: {
    icon: "sparkles",
    title: "Dni płodne",
    text: "Zbliżasz się do owulacji — jeśli nie planujesz ciąży, pamiętaj o ochronie.",
    items: ["Więcej śluzu", "Wzrost energii"],
  },
  luteal: {
    icon: "moon",
    title: "Faza lutealna",
    text: "Po owulacji możesz odczuwać objawy PMS — to normalne przed okresem.",
    items: ["Drażliwość", "Wzdęcia", "Ból piersi", "Zachcianki na słodkie", "Zmęczenie"],
  },
  pills_active: {
    icon: "pill",
    title: "Aktywne dni",
    text: "Bierzesz tabletkę antykoncepcyjną — owulacja jest wyciszona.",
    items: [],
  },
  pills_break: {
    icon: "pill",
    title: "Przerwa w tabletkach",
    text: "Dni przerwy — możesz zauważyć krwawienie z odstawienia.",
    items: [],
  },
  none: {
    icon: "flower",
    title: "Cykl",
    text: "Zaznacz dzień, w którym zaczął się okres, aby Cyklia mogła pokazywać fazy i wskazówki.",
    items: [],
  },
};
