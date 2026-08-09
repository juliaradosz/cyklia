export function iso(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return iso(new Date());
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

export const MOODS = [
  { key: "radosna", emoji: "😊", label: "Radosna" },
  { key: "spokojna", emoji: "😌", label: "Spokojna" },
  { key: "neutralna", emoji: "😐", label: "Neutralna" },
  { key: "przygnębiona", emoji: "😔", label: "Przygnębiona" },
  { key: "zmęczona", emoji: "🥱", label: "Zmęczona" },
  { key: "pobudzona", emoji: "😍", label: "Pobudzona" },
  { key: "drażliwa", emoji: "😠", label: "Drażliwa" },
];

export const SYMPTOMS = [
  "Ból brzucha",
  "Ból pleców",
  "Ból piersi",
  "Ból głowy",
  "Wzdęcia",
  "Mdłości",
  "Trądzik",
  "Brak apetytu",
  "Zwiększony apetyt",
  "Zawroty głowy",
  "Wrażliwość emocjonalna",
  "Bóle mięśni",
];
