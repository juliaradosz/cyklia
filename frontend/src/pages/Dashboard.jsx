import { Link, useNavigate } from "react-router-dom";
import { useCalendar, addPeriod } from "../hooks.js";
import {
  todayISO,
  daysBetween,
  addDays,
  shortPL,
  formatPL,
  nowHM,
  MOODS,
} from "../utils.js";
import { api } from "../api/client.js";
import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";

export default function Dashboard() {
  const { data, reload } = useCalendar();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [pillLog, setPillLog] = useState(null);
  const [pillTimeInput, setPillTimeInput] = useState(nowHM());
  const today = todayISO();

  useEffect(() => {
    (async () => {
      try {
        const [e, c, pl] = await Promise.all([
          api(`/entries/${today}`).catch(() => null),
          api("/cycles"),
          api("/pills/log").catch(() => null),
        ]);
        setEntry(e);
        setCycles(c || []);
        setPillLog(pl);
      } catch {
        /* ignore */
      }
    })();
  }, [today, data]);

  if (!data) return <div className="center-screen">Ładowanie…</div>;

  const pred = data.prediction;
  const onPills = !!pred.on_pills;
  const todayType = data.days[today] || "normal";

  const currentPeriod = cycles.find(
    (c) => c.start_date <= today && (!c.end_date || c.end_date >= today)
  );

  let periodDay = null;
  let periodEnd = null;
  if (currentPeriod) {
    periodDay = daysBetween(currentPeriod.start_date, today) + 1;
    periodEnd =
      currentPeriod.end_date || addDays(currentPeriod.start_date, 4);
  }

  let countdown = null;
  if (pred.next_period_start) {
    countdown = daysBetween(today, pred.next_period_start);
  }

  let cycleDay = null;
  const lastStart = cycles.length
    ? [...cycles].sort((a, b) => a.start_date.localeCompare(b.start_date))[
        cycles.length - 1
      ].start_date
    : null;
  if (lastStart && lastStart <= today) {
    cycleDay = daysBetween(lastStart, today) + 1;
  }

  const fertileToday =
    !onPills &&
    pred.has_data &&
    today >= pred.fertile_start &&
    today <= pred.fertile_end;
  const ovulationToday = !onPills && pred.has_data && pred.ovulation_date === today;

  const moodToday = entry?.mood ? MOODS.find((m) => m.key === entry.mood) : null;
  const symptomList = (() => {
    try {
      return entry?.symptoms ? JSON.parse(entry.symptoms) : [];
    } catch {
      return [];
    }
  })();

  let phaseChip = "Dzień cyklu";
  if (todayType === "period") phaseChip = "Okres";
  else if (onPills) phaseChip = "Tabletki";
  else if (todayType === "ovulation") phaseChip = "Owulacja";
  else if (todayType === "fertile") phaseChip = "Dni płodne";

  let heroBig, heroSub, heroNote;
  if (periodDay) {
    heroBig = (
      <>
        Dzień {periodDay}
        <small>.</small>
      </>
    );
    heroSub = "okresu";
    heroNote = `Koniec ok. ${shortPL(periodEnd)}`;
  } else if (cycleDay) {
    heroBig = (
      <>
        Dzień {cycleDay}
        <small>.</small>
      </>
    );
    heroSub = "cyklu";
    heroNote =
      countdown !== null
        ? countdown > 0
          ? `${countdown} dni do okresu`
          : countdown === 0
          ? "okres — dziś!"
          : `${-countdown} dni po terminie`
        : onPills
        ? "Cykl w trybie tabletek"
        : "";
  } else {
    heroBig = (
      <>
        —
      </>
    );
    heroSub = "zacznij śledzenie";
    heroNote = "Dodaj pierwszy okres w kalendarzu, by zobaczyć prognozy";
  }

  const stats = [
    {
      n: `${pred.cycle_length}`,
      l: "dni cyklu",
    },
    onPills
      ? {
          n: countdown !== null ? `${Math.max(countdown, 0)}` : "—",
          l:
            countdown !== null && countdown <= 0
              ? "okres — dziś"
              : "dni do okresu",
        }
      : {
          n: pred.ovulation_date ? shortPL(pred.ovulation_date) : "—",
          l: "owulacja",
        },
    {
      n: onPills ? "—" : countdown !== null ? `${Math.max(countdown, 0)}` : "—",
      l: onPills ? "bez owulacji" : "dni do okresu",
    },
  ];

  return (
    <div>
      <div className="hero">
        <div className="hero-top">
          <span className="hero-date">Dziś · {formatPL(today)}</span>
          <span className="hero-chip">{phaseChip}</span>
        </div>
        <div className="hero-big">{heroBig}</div>
        <div className="hero-sub">{heroSub}</div>
        {heroNote && <div className="hero-note">{heroNote}</div>}
        <div className="hero-stats">
          {stats.map((s, i) => (
            <div key={i} className="hero-stat">
              <div className="n">{s.n}</div>
              <div className="l">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {onPills && pillLog && pillLog.needs_log && (
        <div className="pill-card">
          <div className="pc-head">
            <span className="pc-ico">
              <Icon name="pill" size={20} />
            </span>
            <div className="pc-hd">
              <b>Tabletka dzisiaj</b>
              <span className="pc-sub">Zwykła pora: {pillLog.expected_time}</span>
            </div>
          </div>
          {pillLog.taken ? (
            <>
              <div className={`pc-status ${pillLog.late ? "late" : "ok"}`}>
                <Icon name={pillLog.late ? "zap" : "check"} size={16} />
                {pillLog.late
                  ? `Wzięta spóźniona o ${pillLog.taken_at}`
                  : `Wzięta o ${pillLog.taken_at}`}
              </div>
              {pillLog.warning && (
                <div className="pc-warn">
                  <Icon name="info" size={15} />
                  <span>{pillLog.warning}</span>
                </div>
              )}
              <div className="pc-actions">
                <button className="pc-undo" onClick={undoPill}>
                  Cofnij
                </button>
              </div>
            </>
          ) : (
            <div className="pc-log">
              <input
                type="time"
                className="pc-time"
                value={pillTimeInput}
                onChange={(e) => setPillTimeInput(e.target.value)}
              />
              <button className="btn small" onClick={logPill}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Icon name="check" size={15} /> Wzięłam tabletkę
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {onPills && (!pillLog || !pillLog.needs_log) && (
        <div className="info-banner">
          <span className="ib-ico">
            <Icon name="pill" size={18} />
          </span>
          <div className="ib-text">
            {pillLog && pillLog.day_type === "period" ? (
              <>
                <b>Przerwa od tabletek</b> — w trakcie przerwy nie przyjmujesz
                tabletki. Kolejny blister zacznij po jej zakończeniu.
              </>
            ) : (
              <>
                <b>Tryb tabletek</b> — brak owulacji i dni płodnych. Kolejny
                okres przewidywany w przerwie między blistrami.
              </>
            )}
          </div>
        </div>
      )}

      <div className="quick-actions">
        <button className="qa" onClick={() => navigate("/dziennik")}>
          <span className="qa-ico">
            <Icon name="pen" size={22} />
          </span>
          <span className="qa-lbl">Dodaj wpis</span>
        </button>
        <button className="qa" onClick={() => navigate("/dziennik")}>
          <span className="qa-ico">
            <Icon name="heart" size={22} />
          </span>
          <span className="qa-lbl">Objawy</span>
        </button>
        <button className="qa" onClick={() => navigate("/kalendarz")}>
          <span className="qa-ico">
            <Icon name="calendar" size={22} />
          </span>
          <span className="qa-lbl">Kalendarz</span>
        </button>
      </div>

      {(ovulationToday || fertileToday || todayType === "period") && (
        <div className="spread mb" style={{ marginTop: 4 }}>
          {todayType === "period" && (
            <span className="status-pill pink">
              <span className="dot" /> Okres
            </span>
          )}
          {ovulationToday && (
            <span className="status-pill mauve">
              <span className="dot" /> Owulacja — dziś!
            </span>
          )}
          {fertileToday && !ovulationToday && (
            <span className="status-pill green">
              <span className="dot" /> Jesteś w oknie płodnym
            </span>
          )}
        </div>
      )}

      <div className="section-head">
        <h2>Dzisiejszy wpis</h2>
        {entry && (
          <Link to="/dziennik" className="more">
            Edytuj
          </Link>
        )}
      </div>

      <div className="today-entry">
        <div className="te-mood">{moodToday ? moodToday.emoji : "🌱"}</div>
        <div className="te-body">
          <div className="te-title">
            {entry
              ? moodToday
                ? `Nastrój: ${moodToday.label}`
                : "Wpis zapisany"
              : "Brak wpisu na dziś"}
          </div>
          <div className="te-sub">
            {entry
              ? [
                  entry.temperature ? `${entry.temperature}°C` : null,
                  entry.sleep ? `Sen ${entry.sleep} h` : null,
                  entry.steps ? `${entry.steps} kroków` : null,
                ]
                  .filter(Boolean)
                  .concat(symptomList.slice(0, 2))
                  .join(" · ") || "Dodaj szczegóły dnia"
              : "Zapisz nastrój, objawy i temperaturę w dzienniku"}
          </div>
        </div>
        <button
          className="te-cta"
          onClick={() => navigate("/dziennik")}
          aria-label="Przejdź do dziennika"
        >
          <Icon name="chevron-right" size={20} />
        </button>
      </div>

      {!currentPeriod && (
        <button className="btn ghost block" onClick={logPeriodToday}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="calendar" size={17} /> Zaznacz początek okresu
          </span>
        </button>
      )}
    </div>
  );

  async function logPeriodToday() {
    if (currentPeriod) return;
    await addPeriod(today, undefined, 1);
    reload();
  }

  async function logPill() {
    try {
      const pl = await api("/pills/log", {
        method: "POST",
        body: { time: pillTimeInput },
      });
      setPillLog(pl);
    } catch {
      /* ignore */
    }
  }

  async function undoPill() {
    try {
      const pl = await api("/pills/log", { method: "DELETE", body: {} });
      setPillLog(pl);
      setPillTimeInput(nowHM());
    } catch {
      /* ignore */
    }
  }
}
