import { Link, useNavigate } from "react-router-dom";
import { useCalendar, addPeriod } from "../hooks.js";
import { todayISO, daysBetween, shortPL, formatPL, MOODS } from "../utils.js";
import { api } from "../api/client.js";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const { data, reload } = useCalendar();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [cycles, setCycles] = useState([]);
  const today = todayISO();

  useEffect(() => {
    (async () => {
      try {
        const [e, c] = await Promise.all([
          api(`/entries/${today}`).catch(() => null),
          api("/cycles"),
        ]);
        setEntry(e);
        setCycles(c || []);
      } catch {
        /* ignore */
      }
    })();
  }, [today, data]);

  if (!data) return <div className="center-screen">Ładowanie…</div>;

  const pred = data.prediction;
  const todayType = data.days[today] || "normal";
  const currentPeriod = cycles.find(
    (c) => c.start_date <= today && (!c.end_date || c.end_date >= today)
  );

  let countdown = null;
  let countdownLabel = "";
  if (pred.next_period_start) {
    const diff = daysBetween(today, pred.next_period_start);
    countdown = diff;
    if (diff > 0) countdownLabel = "dni do okresu";
    else if (diff === 0) countdownLabel = "okres — dziś";
    else countdownLabel = "po terminie";
  }

  const fertileToday =
    today >= pred.fertile_start && today <= pred.fertile_end && pred.has_data;
  const ovulationToday = pred.has_data && pred.ovulation_date === today;

  const moodToday = entry?.mood
    ? MOODS.find((m) => m.key === entry.mood)
    : null;

  async function logPeriodToday() {
    if (currentPeriod) return;
    await addPeriod(today, undefined, 1);
    reload();
  }

  return (
    <div>
      <div className="hero">
        <div className="label">Dziś · {formatPL(today)}</div>
        {countdown !== null ? (
          <>
            <div className="big">
              {countdown > 0 ? `${countdown}` : countdown === 0 ? "Dziś!" : `${-countdown}`}
            </div>
            <div className="label">{countdownLabel}</div>
          </>
        ) : (
          <>
            <div className="big">—</div>
            <div className="label">
              Dodaj pierwszy okres w kalendarzu, by zobaczyć prognozy
            </div>
          </>
        )}
        <div className="stats-line">
          <span>
            Cykl: {pred.cycle_length} dni
          </span>
          <span>
            Owulacja:{" "}
            {pred.ovulation_date ? shortPL(pred.ovulation_date) : "—"}
          </span>
        </div>
      </div>

      <div className="spread mb">
        <div className="day-chip">
          {todayType === "period"
            ? "🩸 Okres"
            : todayType === "ovulation"
            ? "🥚 Owulacja"
            : todayType === "fertile"
            ? "🌱 Dni płodne"
            : "🌸 Dzień cyklu"}
        </div>
        {ovulationToday && <div className="day-chip">🥚 Owulacja — dziś!</div>}
        {fertileToday && !ovulationToday && (
          <div className="day-chip">🌱 Jesteś w oknie płodnym</div>
        )}
      </div>

      <div className="card">
        <h2>Dzisiejszy wpis</h2>
        {moodToday ? (
          <div className="row">
            <span>
              {moodToday.emoji} Nastrój: {moodToday.label}
            </span>
            <Link to="/dziennik" className="btn small ghost">
              Edytuj
            </Link>
          </div>
        ) : (
          <p className="muted">
            Brak wpisu na dziś. Zapisz nastrój i objawy w dzienniku.
          </p>
        )}
        <div className="spread mt">
          {!currentPeriod && (
            <button className="btn ghost" onClick={logPeriodToday}>
              🩸 Zaznacz okres
            </button>
          )}
          <button className="btn" onClick={() => navigate("/dziennik")}>
            📝 Wpisz dzisiaj
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Szybkie skróty</h2>
        <div className="spread">
          <Link to="/kalendarz" className="btn small ghost">
            📅 Kalendarz
          </Link>
          <Link to="/statystyki" className="btn small ghost">
            📊 Statystyki
          </Link>
          <Link to="/czat" className="btn small ghost">
            💬 Zapytaj asystenta
          </Link>
          <Link to="/artykuly" className="btn small ghost">
            📖 Artykuły
          </Link>
        </div>
      </div>
    </div>
  );
}
