import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import Icon from "../components/Icon.jsx";
import CoupleQuiz from "../components/CoupleQuiz.jsx";
import DateIdeas from "../components/DateIdeas.jsx";

// Ekran „Dla par”: czego dziś potrzebuję (widzi partner), quiz dla par, pomysły na randkę.
export default function CouplePage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [sel, setSel] = useState([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/couple")
      .then((d) => {
        setData(d);
        setSel(d.needs.keys);
        setNote(d.needs.note);
      })
      .catch((e) => setErr(e.message));
  }, []);

  if (err && !data) return <div className="error">{err}</div>;
  if (!data) return <div className="center-screen">Ładowanie…</div>;

  function toggle(k) {
    setSaved("");
    setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length >= 6 ? s : [...s, k]));
  }

  async function saveNeeds() {
    setErr("");
    try {
      const n = await api("/couple/needs", { method: "PUT", body: { needs: sel, note } });
      setSel(n.keys);
      setNote(n.note);
      setSaved(data.has_partner ? "✓ Zapisane — partner zobaczy to w swoim widoku." : "✓ Zapisane.");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <div className="sub-screen-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Wróć">
          <Icon name="chevron-left" size={20} />
        </button>
        <h1>Dla par</h1>
      </div>

      {!data.has_partner && (
        <div className="j-section">
          <p className="muted" style={{ marginTop: 0 }}>
            Wyślij partnerowi prywatny link — zobaczy, jak się dziś czujesz, czego
            potrzebujesz, czy tabletka jest wzięta, i rozwiąże z Tobą quiz.
          </p>
          <button className="btn block" onClick={() => navigate("/profil?view=partner")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon name="link" size={16} /> Utwórz link dla partnera
            </span>
          </button>
        </div>
      )}

      <div className="j-section">
        <div className="j-sec-head">
          <span className="js-ico">
            <Icon name="heart" size={17} />
          </span>
          <b>Czego dziś potrzebuję</b>
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Zaznacz, a partner zobaczy to w swoim widoku — bez tłumaczenia się.
        </p>
        <div className="symptoms-grid">
          {data.needs_options.map((n) => (
            <button
              key={n.key}
              type="button"
              className={`symptom-chip ${sel.includes(n.key) ? "on" : ""}`}
              onClick={() => toggle(n.key)}
            >
              {n.emoji} {n.label}
            </button>
          ))}
        </div>
        <input
          className="sheet-input mt"
          placeholder="Krótka wiadomość (opcjonalnie), np. „kup lody 🍦”"
          maxLength={140}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved("");
          }}
        />
        <button className="btn block mt" onClick={saveNeeds}>
          Zapisz na dziś
        </button>
        {saved && <div className="muted mt" style={{ fontSize: 13 }}>{saved}</div>}
        {err && <div className="error mt">{err}</div>}
      </div>

      <CoupleQuiz
        quiz={data.quiz}
        mineKey="her"
        otherKey="partner"
        meLabel="Ty"
        otherLabel="Partner"
        waitingText={
          data.has_partner
            ? "Wynik zobaczycie, gdy partner odpowie w swoim widoku."
            : "Wynik zobaczycie, gdy partner odpowie — najpierw utwórz dla niego link."
        }
        onSubmit={(answers) => api("/couple/quiz", { method: "POST", body: { answers } })}
      />

      <DateIdeas
        ideas={data.ideas}
        hint={
          data.phase
            ? `Dopasowane do fazy: ${data.phase.toLowerCase()}. Partner widzi te same pomysły.`
            : "Partner widzi te same pomysły."
        }
      />
    </div>
  );
}
