import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import {
  todayISO,
  formatPL,
  shortPL,
  MOODS,
  SYMPTOMS,
  LIBIDO,
  MUCUS,
} from "../utils.js";

const EMPTY = {
  temperature: "",
  mood: "",
  symptoms: [],
  notes: "",
  water: 0,
  sleep: "",
  activity: 0,
  libido: "",
  stress: "",
  mucus: "",
  weight: "",
};

export default function JournalPage() {
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState(EMPTY);
  const [entries, setEntries] = useState([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadList() {
    try {
      const rows = await api("/entries");
      setEntries(rows.slice(0, 12));
    } catch {
      setEntries([]);
    }
  }

  async function loadEntry(day) {
    setDate(day);
    try {
      const e = await api(`/entries/${day}`);
      if (e) {
        setForm({
          temperature: e.temperature ?? "",
          mood: e.mood ?? "",
          symptoms: e.symptoms ? JSON.parse(e.symptoms) : [],
          notes: e.notes ?? "",
          water: e.water ?? 0,
          sleep: e.sleep ?? "",
          activity: e.activity ?? 0,
          libido: e.libido ?? "",
          stress: e.stress ?? "",
          mucus: e.mucus ?? "",
          weight: e.weight ?? "",
        });
      } else {
        setForm(EMPTY);
      }
    } catch {
      setForm(EMPTY);
    }
  }

  useEffect(() => {
    loadEntry(date);
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSymptom(s) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(s)
        ? f.symptoms.filter((x) => x !== s)
        : [...f.symptoms, s],
    }));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/entries/${date}`, {
        method: "PUT",
        body: {
          temperature: form.temperature ? Number(form.temperature) : null,
          mood: form.mood || null,
          symptoms: form.symptoms,
          notes: form.notes || null,
          water: form.water ? Number(form.water) : null,
          sleep: form.sleep ? Number(form.sleep) : null,
          activity: form.activity ? Number(form.activity) : null,
          libido: form.libido || null,
          stress: form.stress ? Number(form.stress) : null,
          mucus: form.mucus || null,
          weight: form.weight ? Number(form.weight) : null,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  function moodEmoji(key) {
    return MOODS.find((m) => m.key === key)?.emoji || "🙂";
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dziennik</h1>
          <div className="sub">Objawy, nastrój, temperatura i samopoczucie</div>
        </div>
      </div>

      <form onSubmit={save}>
        <div className="card">
          <div className="field">
            <label>Data</label>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => {
                const d = e.target.value;
                setDate(d);
                loadEntry(d);
              }}
            />
          </div>

          <div className="spread">
            <div className="field" style={{ flex: 1 }}>
              <label>Temperatura bazowa (°C)</label>
              <input
                type="number"
                step="0.01"
                min="35"
                max="41"
                value={form.temperature}
                onChange={(e) =>
                  setForm({ ...form, temperature: e.target.value })
                }
                placeholder="np. 36.60"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Waga (kg)</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="200"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="np. 62.5"
              />
            </div>
          </div>

          <div className="field">
            <label>Nastrój</label>
            <div className="mood-row">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`mood-btn ${form.mood === m.key ? "on" : ""}`}
                  onClick={() => setForm({ ...form, mood: m.key })}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Objawy</label>
            <div className="symptoms-grid">
              {SYMPTOMS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`symptom-pill ${
                    form.symptoms.includes(s) ? "on" : ""
                  }`}
                  onClick={() => toggleSymptom(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="spread">
            <div className="field" style={{ flex: 1 }}>
              <label>Libido</label>
              <select
                value={form.libido}
                onChange={(e) => setForm({ ...form, libido: e.target.value })}
              >
                <option value="">—</option>
                {LIBIDO.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Śluz szyjkowy</label>
              <select
                value={form.mucus}
                onChange={(e) => setForm({ ...form, mucus: e.target.value })}
              >
                <option value="">—</option>
                {MUCUS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="spread">
            <div className="field" style={{ flex: 1 }}>
              <label>Poziom stresu</label>
              <select
                value={form.stress}
                onChange={(e) =>
                  setForm({ ...form, stress: Number(e.target.value) })
                }
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1 — bardzo niski" : n === 5 ? "5 — bardzo wysoki" : n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Sen (godziny)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="16"
                value={form.sleep}
                onChange={(e) => setForm({ ...form, sleep: e.target.value })}
                placeholder="np. 7.5"
              />
            </div>
          </div>

          <div className="spread">
            <div className="field" style={{ flex: 1 }}>
              <label>Woda (szklanki)</label>
              <select
                value={form.water}
                onChange={(e) =>
                  setForm({ ...form, water: Number(e.target.value) })
                }
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Aktywność (min)</label>
              <input
                type="number"
                min="0"
                max="600"
                value={form.activity}
                onChange={(e) =>
                  setForm({ ...form, activity: e.target.value })
                }
                placeholder="np. 45"
              />
            </div>
          </div>

          <div className="field">
            <label>Notatki</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Jak się czujesz? Co Cię cieszyło lub męczyło?"
            />
          </div>

          <button className="btn block" disabled={busy}>
            {saved ? "✓ Wpis zapisany!" : busy ? "Zapisywanie…" : "Zapisz wpis"}
          </button>
          {saved && (
            <p className="center muted mt" style={{ fontSize: 12, color: "#3f8f5a" }}>
              Wpis dla dnia {formatPL(date)} został zapisany. Możesz go edytować
              wybierając datę lub klikając „Edytuj" na liście poniżej.
            </p>
          )}
        </div>
      </form>

      <div className="card">
        <h2>Zapisane wpisy</h2>
        {entries.length === 0 && (
          <p className="muted">Brak zapisanych wpisów. Dodaj pierwszy powyżej!</p>
        )}
        {entries.map((e) => {
          const syms = (() => {
            try {
              return JSON.parse(e.symptoms || "[]");
            } catch {
              return [];
            }
          })();
          return (
            <div key={e.date} className="row mb">
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{formatPL(e.date)}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  {moodEmoji(e.mood)} {e.mood || "brak nastroju"}
                  {e.temperature ? ` · ${e.temperature}°C` : ""}
                  {syms.length ? ` · ${syms.slice(0, 3).join(", ")}` : ""}
                </div>
              </div>
              <button
                className="btn small ghost"
                onClick={() => loadEntry(e.date)}
              >
                Edytuj
              </button>
            </div>
          );
        })}
      </div>

      <p className="muted center" style={{ fontSize: 12 }}>
        Data wpisu: {formatPL(date)}
      </p>
    </div>
  );
}
