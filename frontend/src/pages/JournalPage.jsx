import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { todayISO, formatPL, MOODS, SYMPTOMS } from "../utils.js";

export default function JournalPage() {
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState({
    temperature: "",
    mood: "",
    symptoms: [],
    notes: "",
    water: 0,
    sleep: "",
    activity: 0,
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSaved(false);
    api(`/entries/${date}`)
      .then((e) => {
        if (e) {
          setForm({
            temperature: e.temperature ?? "",
            mood: e.mood ?? "",
            symptoms: e.symptoms ? JSON.parse(e.symptoms) : [],
            notes: e.notes ?? "",
            water: e.water ?? 0,
            sleep: e.sleep ?? "",
            activity: e.activity ?? 0,
          });
        } else {
          setForm({
            temperature: "",
            mood: "",
            symptoms: [],
            notes: "",
            water: 0,
            sleep: "",
            activity: 0,
          });
        }
      })
      .catch(() => {});
  }, [date]);

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
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dziennik</h1>
          <div className="sub">Codzienne objawy, nastrój i temperatura</div>
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
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="field">
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

          <div className="field">
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

          <div className="field">
            <label>Notatki</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Jak się czujesz? Co Cię cieszyło lub męczyło?"
            />
          </div>

          <button className="btn block" disabled={busy}>
            {saved ? "✓ Zapisano" : busy ? "Zapisywanie…" : "Zapisz wpis"}
          </button>
          <p className="muted center mt" style={{ fontSize: 12 }}>
            Wpis dotyczy dnia: {formatPL(date)}
          </p>
        </div>
      </form>
    </div>
  );
}
