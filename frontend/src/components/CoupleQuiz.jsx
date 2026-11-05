import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";

// Codzienny quiz dla par. Każda osoba odpowiada o sobie, a po odpowiedziach obu
// pokazujemy, ile odpowiedzi było zgodnych.
// props: quiz (stan z API), onSubmit(answers) → Promise<nowy stan>,
//        meLabel / otherLabel — jak podpisać odpowiedzi w podsumowaniu,
//        mineKey / otherKey — "her" | "partner" (klucze w result.items)
export default function CoupleQuiz({ quiz, onSubmit, meLabel, otherLabel, mineKey, otherKey, waitingText }) {
  const [state, setState] = useState(quiz);
  const [answers, setAnswers] = useState([]);
  const [step, setStep] = useState(-1); // -1 = ekran startowy
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setState(quiz), [quiz]);

  if (!state) return null;
  const qs = state.questions;
  const done = !!state.mine;

  async function choose(i) {
    const next = [...answers];
    next[step] = i;
    setAnswers(next);
    if (step < qs.length - 1) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const s = await onSubmit(next);
      setState(s);
      setStep(-1);
    } catch (e) {
      setErr(e.message || "Nie udało się zapisać odpowiedzi.");
    } finally {
      setBusy(false);
    }
  }

  const head = (
    <div className="j-sec-head">
      <span className="js-ico">
        <Icon name="heart" size={17} />
      </span>
      <b>Quiz dla par · {state.topic}</b>
    </div>
  );

  // wynik: obie osoby odpowiedziały
  if (done && state.result) {
    const r = state.result;
    return (
      <div className="j-section quiz">
        {head}
        <div className="quiz-score">
          <div className="quiz-ring" style={{ "--p": r.percent }}>
            <span>{r.percent}%</span>
          </div>
          <div>
            <b>
              {r.matches} z {r.total} zgodnych
            </b>
            <div className="muted" style={{ fontSize: 13 }}>
              {r.verdict}
            </div>
          </div>
        </div>
        <ul className="quiz-list">
          {r.items.map((it) => (
            <li key={it.q} className={it.match ? "ok" : ""}>
              <div className="ql-q">
                <span>{it.match ? "✓" : "≠"}</span> {it.q}
              </div>
              {it.match ? (
                <div className="ql-a">Oboje: {it[mineKey]}</div>
              ) : (
                <div className="ql-a">
                  {meLabel}: {it[mineKey]}
                  <br />
                  {otherLabel}: {it[otherKey]}
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
          Jutro nowy temat {state.emoji}
        </p>
      </div>
    );
  }

  // odpowiedziane, czekamy na drugą osobę
  if (done) {
    return (
      <div className="j-section quiz">
        {head}
        <div className="quiz-wait">
          <span className="quiz-emoji">{state.emoji}</span>
          <div>
            <b>Twoje odpowiedzi zapisane</b>
            <div className="muted" style={{ fontSize: 13 }}>{waitingText}</div>
          </div>
        </div>
        <button className="dp-link" onClick={() => { setAnswers(state.mine); setStep(0); setState({ ...state, mine: null }); }}>
          Zmień odpowiedzi
        </button>
      </div>
    );
  }

  // ekran startowy
  if (step < 0) {
    return (
      <div className="j-section quiz">
        {head}
        <div className="quiz-wait">
          <span className="quiz-emoji">{state.emoji}</span>
          <div>
            <b>Dzisiejszy temat: {state.topic}</b>
            <div className="muted" style={{ fontSize: 13 }}>
              {qs.length} pytań · odpowiadajcie osobno, o sobie.
              {state.other_done ? ` ${otherLabel} ma już swoje odpowiedzi!` : ""}
            </div>
          </div>
        </div>
        <button className="btn block" onClick={() => setStep(0)}>
          Zaczynam quiz
        </button>
      </div>
    );
  }

  const q = qs[step];
  return (
    <div className="j-section quiz">
      {head}
      <div className="quiz-progress">
        {qs.map((_, i) => (
          <span key={i} className={i <= step ? "on" : ""} />
        ))}
      </div>
      <div className="quiz-q">{q.q}</div>
      <div className="quiz-opts">
        {q.options.map((o, i) => (
          <button
            key={o}
            className={`quiz-opt${answers[step] === i ? " on" : ""}`}
            disabled={busy}
            onClick={() => choose(i)}
          >
            {o}
          </button>
        ))}
      </div>
      {step > 0 && (
        <button className="dp-link" onClick={() => setStep(step - 1)}>
          ← Poprzednie pytanie
        </button>
      )}
      {err && <div className="error mt">{err}</div>}
    </div>
  );
}
