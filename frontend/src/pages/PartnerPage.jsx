import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import CoupleQuiz from "../components/CoupleQuiz.jsx";
import DateIdeas from "../components/DateIdeas.jsx";
import { dayMonthPL, WEEK_LETTERS, MOODS } from "../utils.js";

const moodLabel = (k) => {
  const m = MOODS.find((x) => x.key === k);
  return m ? `${m.emoji} ${m.label}` : k;
};

// Publiczny widok dla partnera — tylko do odczytu, bez logowania.
// Wygląda jak Start użytkowniczki, a zamiast inspiracji pokazuje,
// jak poprawić jej dzień, quiz dla par i pomysły na randkę.
export default function PartnerPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/p/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Nie udało się wczytać danych.");
        return j;
      })
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token]);

  async function submitQuiz(answers) {
    const r = await fetch(`/api/p/${encodeURIComponent(token)}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Nie udało się zapisać odpowiedzi.");
    return j;
  }

  if (error) {
    return (
      <>
        <div className="app-bg" />
        <main className="page partner-page">
          <div className="j-section center">
            <Icon name="lock" size={28} style={{ color: "var(--pink-500)" }} />
            <p style={{ marginBottom: 0 }}>{error}</p>
            <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Poproś o nowy link w aplikacji Cyklia.
            </p>
          </div>
        </main>
      </>
    );
  }
  if (!data) return <div className="center-screen">Ładowanie…</div>;

  const today = data.date;
  const name = data.name;
  const fertile = data.fertile;
  const fertileUpcoming = fertile && !fertile.today && fertile.end >= today;
  const pills = data.pills;
  const patch = data.patch;
  const feel = data.feel;
  const needs = data.needs;
  const tips = data.tips || [];
  const todayMoods = feel?.today_moods || [];
  const todaySyms = feel?.today_symptoms || [];

  let pillCard = null;
  if (pills) {
    const late = pills.taken && pills.late;
    let title, sub, cls, ico;
    if (pills.in_break) {
      title = "Dziś przerwa w tabletkach";
      sub = pills.next_pack_start ? `Nowy blister: ${dayMonthPL(pills.next_pack_start)}` : "Bez tabletki w przerwie";
      cls = "";
      ico = "pill";
    } else if (pills.taken) {
      title = `Tabletka wzięta o ${pills.taken_at}`;
      sub = late ? "Wzięta później niż zwykle" : `Zwykle o ${pills.expected_time}`;
      cls = late ? " late" : " done";
      ico = "check";
    } else if (pills.needs_log) {
      title = "Tabletka jeszcze nie wzięta";
      sub = `Zwykle o ${pills.expected_time} — możesz delikatnie przypomnieć 💊`;
      cls = " late";
      ico = "bell";
    } else {
      title = "Tabletki";
      sub = "Brak informacji o dzisiejszej tabletce";
      cls = "";
      ico = "pill";
    }
    pillCard = (
      <div className={`dash-pill j-section${cls}`}>
        <div className="dp-row">
          <div className="dp-ico">
            <Icon name={ico} size={20} />
          </div>
          <div className="dp-body">
            <b>{title}</b>
            <span className="dp-sub">
              {pills.pack_day > 0 ? `Dzień ${pills.pack_day} z ${pills.active_days} · ` : ""}
              {sub}
            </span>
          </div>
        </div>
      </div>
    );
  } else if (patch && patch.message) {
    pillCard = (
      <div className={`dash-pill j-section${patch.needs_change ? (patch.applied ? " done" : " late") : ""}`}>
        <div className="dp-row">
          <div className="dp-ico">
            <Icon name={patch.applied ? "check" : "pill"} size={20} />
          </div>
          <div className="dp-body">
            <b>
              {patch.needs_change
                ? patch.applied
                  ? "Plaster zmieniony ✓"
                  : "Dziś dzień zmiany plastra"
                : "Plaster antykoncepcyjny"}
            </b>
            <span className="dp-sub">{patch.message}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="app-bg" />
      <main className="page partner-page">
        <div className="dash-hero">
          <div className="dash-top">
            <div className="dash-date">{dayMonthPL(today)}</div>
            <span className="partner-badge">
              <Icon name="heart" size={14} /> widok partnera
            </span>
          </div>
          {data.week && (
            <div className="week-row">
              {data.week.map((d, i) => (
                <div key={d.date} className={`week-day${d.date === today ? " today active" : ""}`}>
                  <span className="wd-letter">{WEEK_LETTERS[i]}</span>
                  <span className={`wd-num${d.type === "period" ? " period" : ""}`}>
                    {Number(d.date.slice(8, 10))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="partner-status">
          <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
            {name} · dziś
          </div>
          <div className="ds-phase">{data.headline}</div>
          {data.sub && <div className="ds-day">{data.sub}</div>}
          {data.phase && data.phase !== data.headline && <div className="ds-note">{data.phase}</div>}
          {data.next_period_start && !data.period_day && (
            <div className="ds-note">Następny okres: {dayMonthPL(data.next_period_start)}</div>
          )}
          {(todayMoods.length > 0 || todaySyms.length > 0) && (
            <div className="chips partner-today">
              {todayMoods.map((m) => (
                <span key={m} className="chip on">
                  {moodLabel(m)}
                </span>
              ))}
              {todaySyms.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {needs && (needs.items.length > 0 || needs.note) && (
          <div className="j-section partner-needs">
            <div className="j-sec-head">
              <span className="js-ico">
                <Icon name="heart" size={17} />
              </span>
              <b>{name} dziś potrzebuje</b>
            </div>
            {needs.items.length > 0 && (
              <div className="chips">
                {needs.items.map((n) => (
                  <span key={n.key} className="chip on">
                    {n.emoji} {n.label}
                  </span>
                ))}
              </div>
            )}
            {needs.note && <p className="partner-note">„{needs.note}”</p>}
          </div>
        )}

        {pillCard}

        {fertile && (fertile.today || fertileUpcoming) && (
          <div className="j-section">
            <div className="j-sec-head">
              <span className="js-ico" style={{ background: "var(--blue-100)", color: "var(--blue)" }}>
                <Icon name="droplet" size={17} />
              </span>
              <b>Dni płodne</b>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {fertile.ovulation_today
                ? "Dziś przewidywana owulacja — najwyższa szansa na ciążę."
                : fertile.today
                ? `Trwają dni płodne (do ${dayMonthPL(fertile.end)}).`
                : `Dni płodne: ${dayMonthPL(fertile.start)} – ${dayMonthPL(fertile.end)}.`}{" "}
              To prognoza, nie metoda antykoncepcji.
            </p>
          </div>
        )}

        <div className="section-head">
          <h2>Jak poprawić jej dzień</h2>
        </div>
        {feel?.text && <p className="partner-feel">{feel.text}</p>}
        {tips.length > 0 && (
          <div className="inspo-scroll">
            {tips.map((t, i) => (
              <div key={t.title} className={`inspo-tile tip-tile tile-${i % 4}`}>
                <span className="inspo-emoji">{t.emoji}</span>
                <span className="inspo-title">{t.title}</span>
                <span className="tip-text">{t.text}</span>
                <span className="inspo-meta">
                  {t.source === "today"
                    ? "na podstawie dzisiejszych wpisów"
                    : t.source === "usual"
                    ? "zwykle w tej fazie"
                    : "w tej fazie cyklu"}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.quiz && (
          <CoupleQuiz
            quiz={data.quiz}
            mineKey="partner"
            otherKey="her"
            meLabel="Ty"
            otherLabel={name}
            waitingText={`Wynik zobaczycie, gdy ${name} też odpowie w aplikacji.`}
            onSubmit={submitQuiz}
          />
        )}

        <DateIdeas ideas={data.ideas} hint={data.phase ? `Dopasowane do fazy: ${data.phase.toLowerCase()}.` : null} />

        <p className="muted center" style={{ fontSize: 11.5 }}>
          {name} udostępnia Ci ten widok w aplikacji Cyklia i może go w każdej chwili
          wyłączyć. Prognozy mają charakter edukacyjny.
        </p>
      </main>
    </>
  );
}
