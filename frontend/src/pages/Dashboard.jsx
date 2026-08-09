import { Link, useNavigate } from "react-router-dom";
import { useCalendar, addPeriod, removePeriod } from "../hooks.js";
import { emojiFor } from "../inspiration.js";
import {
  todayISO,
  daysBetween,
  addDays,
  dayMonthPL,
  weekOf,
  WEEK_LETTERS,
  nowHM,
} from "../utils.js";
import { api } from "../api/client.js";
import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";

const SEX_ACT = [
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

const LIBIDO_ACT = ["Wysokie libido", "Średnie libido", "Niskie libido"];

export default function Dashboard() {
  const { data, reload } = useCalendar();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [inspos, setInspos] = useState([]);
  const [pillLog, setPillLog] = useState(null);
  const [pillTimeInput, setPillTimeInput] = useState(nowHM());
  const [sheet, setSheet] = useState(null);
  const [sexSel, setSexSel] = useState([]);
  const [libidoSel, setLibidoSel] = useState("");
  const [periodId, setPeriodId] = useState(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const today = todayISO();

  useEffect(() => {
    (async () => {
      try {
        const [e, c, ins, pl] = await Promise.all([
          api(`/entries/${today}`).catch(() => null),
          api("/cycles").catch(() => []),
          api("/inspirations").catch(() => []),
          api("/pills/log").catch(() => null),
        ]);
        setEntry(e);
        setCycles(c || []);
        setInspos(ins || []);
        setPillLog(pl);
        try {
          const sex = e?.sex ? JSON.parse(e.sex) : [];
          setSexSel(SEX_ACT.filter((a) => sex.includes(a)));
          setLibidoSel(LIBIDO_ACT.find((l) => sex.includes(l)) || "");
        } catch {
          /* ignore */
        }
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

  const sortedStarts = [...cycles].sort((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );
  const lastStart = sortedStarts.length ? sortedStarts[sortedStarts.length - 1].start_date : null;
  const periodDay = currentPeriod
    ? daysBetween(currentPeriod.start_date, today) + 1
    : null;
  const cycleDay = lastStart && lastStart <= today
    ? daysBetween(lastStart, today) + 1
    : null;

  let cycleLen = pred.cycle_length;
  if (sortedStarts.length >= 2) {
    const a = sortedStarts[sortedStarts.length - 2].start_date;
    const b = sortedStarts[sortedStarts.length - 1].start_date;
    const diff = daysBetween(a, b);
    if (diff > 0) cycleLen = diff;
  }

  const countdown = pred.next_period_start
    ? daysBetween(today, pred.next_period_start)
    : null;

  let phaseLabel = "Śledzenie";
  if (todayType === "period") phaseLabel = "Okres";
  else if (todayType === "ovulation") phaseLabel = "Owulacja";
  else if (todayType === "fertile") phaseLabel = "Dni płodne";
  else if (onPills) phaseLabel = "Aktywne dni";
  else if (cycleDay && pred.cycle_length) {
    phaseLabel =
      cycleDay < pred.cycle_length - 14 ? "Faza folikularna" : "Faza lutealna";
  }

  const dayLine = periodDay
    ? `Dzień ${periodDay}`
    : cycleDay
    ? `Dzień ${cycleDay} cyklu`
    : "Zacznij śledzenie";
  const noteLine = periodDay
    ? `Cykl trwał ${cycleLen} dni`
    : countdown !== null
    ? countdown > 0
      ? `${countdown} dni do okresu`
      : countdown === 0
      ? "okres — dziś!"
      : `${-countdown} dni po terminie`
    : onPills
    ? "Kolejna przerwa wg kalendarza"
    : "Dodaj okres w kalendarzu";

  const week = weekOf(today);

  function openSex() {
    setSheet("sex");
  }

  function openPeriod() {
    if (!currentPeriod) return;
    setPeriodId(currentPeriod.id);
    setPeriodStart(currentPeriod.start_date);
    setPeriodEnd(currentPeriod.end_date || "");
    setSheet("period");
  }

  function toggleSex(a) {
    setSexSel((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  async function saveSex() {
    try {
      const items = [...sexSel];
      const lib = libidoSel ? libidoSel.split(" ")[0] : null;
      if (lib) items.push(libidoSel);
      await api(`/entries/${today}`, {
        method: "PUT",
        body: { sex: items, libido: lib },
      });
      const e = await api(`/entries/${today}`).catch(() => null);
      setEntry(e);
      setSheet(null);
    } catch {
      /* ignore */
    }
  }

  async function savePeriod() {
    try {
      await api(`/cycles/${periodId}`, {
        method: "PATCH",
        body: { start_date: periodStart, end_date: periodEnd || null },
      });
      setSheet(null);
      reload();
    } catch {
      /* ignore */
    }
  }

  async function deletePeriod() {
    try {
      await removePeriod(periodId);
      setSheet(null);
      reload();
    } catch {
      /* ignore */
    }
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

  return (
    <div className="dash">
      <div className="dash-hero">
        <div className="dash-top">
          <div className="dash-date">{dayMonthPL(today)}</div>
          <button
            className="dash-cal"
            onClick={() => navigate("/kalendarz")}
            aria-label="Kalendarz"
          >
            <Icon name="calendar" size={20} />
          </button>
        </div>
        <div className="week-row">
          {week.map((d, i) => {
            const isPeriodDay = data.days[d] === "period";
            const isToday = d === today;
            const num = Number(d.slice(8, 10));
            return (
              <div key={d} className={`week-day${isToday ? " today" : ""}`}>
                <span className="wd-letter">{WEEK_LETTERS[i]}</span>
                <span className={`wd-num${isPeriodDay ? " period" : ""}`}>
                  {num}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dash-status">
        <div className="ds-left">
          <div className="ds-phase">{phaseLabel}</div>
          <div className="ds-day">{dayLine}</div>
          <div className="ds-note">{noteLine}</div>
        </div>
        <div className="ds-bubbles">
          <button className="ds-bubble" onClick={openPeriod}>
            <span className="ds-b-ico">
              <Icon name="calendar" size={22} />
            </span>
            Edytuj okres
          </button>
          <button className="ds-bubble" onClick={() => navigate("/dziennik")}>
            <span className="ds-b-ico">
              <Icon name="flame" size={22} />
            </span>
            Objawy
          </button>
          <button className="ds-bubble" onClick={openSex}>
            <span className="ds-b-ico">
              <Icon name="heart" size={22} />
            </span>
            Stosunek
          </button>
        </div>
      </div>

      {onPills && pillLog && pillLog.needs_log && (
        <div className="dash-pill">
          <div className="dp-ico">
            <Icon name="pill" size={18} />
          </div>
          {pillLog.taken ? (
            <div className="dp-body">
              <b>
                {pillLog.late ? "Wzięta spóźniona" : "Wzięta"} o {pillLog.taken_at}
              </b>
              <span className="dp-sub">{pillLog.warning || "Tabletka zalogowana"}</span>
              <button className="dp-undo" onClick={undoPill}>
                Cofnij
              </button>
            </div>
          ) : (
            <div className="dp-body">
              <b>Tabletka dzisiaj</b>
              <span className="dp-sub">Zwykła pora: {pillLog.expected_time}</span>
              <div className="dp-log">
                <input
                  type="time"
                  className="pc-time"
                  value={pillTimeInput}
                  onChange={(e) => setPillTimeInput(e.target.value)}
                />
                <button className="btn small" onClick={logPill}>
                  Wzięłam
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="section-head">
        <h2>Moje codzienne inspiracje</h2>
      </div>
      {inspos.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, padding: "6px 2px" }}>
          Dodaj pierwszy okres, by zobaczyć dopasowane inspiracje.
        </p>
      ) : (
        <div className="inspo-scroll">
          {inspos.map((a, i) => (
            <Link
              key={a.id}
              to={`/inspiracje/${a.id}`}
              className={`inspo-tile tile-${i % 4}`}
            >
              <span className="inspo-emoji">{emojiFor(a)}</span>
              <span className="inspo-title">{a.title}</span>
              <span className="inspo-meta">
                {a.read_minutes ? `${a.read_minutes} min czytania` : "artykuł"}
              </span>
            </Link>
          ))}
        </div>
      )}

      {!currentPeriod && (
        <button
          className="btn ghost block mt"
          onClick={async () => {
            await addPeriod(today, undefined, 1);
            reload();
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="calendar" size={17} /> Zaznacz początek okresu
          </span>
        </button>
      )}

      {sheet === "sex" && (
        <div className="sheet-overlay" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>Seks i libido</b>
              <button className="icon-btn" onClick={() => setSheet(null)} aria-label="Zamknij">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="sheet-sub">Aktywność seksualna</div>
            <div className="sex-grid">
              {SEX_ACT.map((a) => (
                <button
                  key={a}
                  className={`sex-chip${sexSel.includes(a) ? " on" : ""}`}
                  onClick={() => toggleSex(a)}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="sheet-sub">Libido</div>
            <div className="sex-grid">
              {LIBIDO_ACT.map((l) => (
                <button
                  key={l}
                  className={`sex-chip${libidoSel === l ? " on" : ""}`}
                  onClick={() => setLibidoSel(libidoSel === l ? "" : l)}
                >
                  {l}
                </button>
              ))}
            </div>
            <button className="btn block mt" onClick={saveSex}>
              Zapisz
            </button>
          </div>
        </div>
      )}

      {sheet === "period" && currentPeriod && (
        <div className="sheet-overlay" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>Edytuj okres</b>
              <button className="icon-btn" onClick={() => setSheet(null)} aria-label="Zamknij">
                <Icon name="x" size={18} />
              </button>
            </div>
            <label className="sheet-lbl">Początek</label>
            <input
              type="date"
              className="sheet-input"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
            <label className="sheet-lbl">Koniec (opcjonalnie)</label>
            <input
              type="date"
              className="sheet-input"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
            <button className="btn block mt" onClick={savePeriod}>
              Zapisz zmiany
            </button>
            <button className="btn ghost block danger mt" onClick={deletePeriod}>
              Usuń ten okres
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
