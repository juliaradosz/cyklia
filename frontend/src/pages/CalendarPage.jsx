import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCalendar } from "../hooks.js";
import { api } from "../api/client.js";
import {
  todayISO,
  parseISO,
  iso,
  addDays,
  daysBetween,
  formatPL,
  MOODS,
} from "../utils.js";
import Icon from "../components/Icon.jsx";

const DOW = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

function monthCells(y, m) {
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(y, m, 1 - lead);
  const out = [];
  for (let i = 0; i < 42; i++) {
    const dayISO = addDays(iso(start), i);
    const dd = parseISO(dayISO);
    out.push({
      iso: dayISO,
      day: dd.getDate(),
      inMonth: dd.getMonth() === m && dd.getFullYear() === y,
    });
  }
  return out;
}

export default function CalendarPage() {
  const { data, reload } = useCalendar();
  const navigate = useNavigate();
  const today = todayISO();
  const t = parseISO(today);
  const [view, setView] = useState("month");
  const [anchor, setAnchor] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const [year, setYear] = useState(t.getFullYear());
  const [cycles, setCycles] = useState([]);
  const [entries, setEntries] = useState([]);
  const [pillDates, setPillDates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [entry, setEntry] = useState(null);
  const [selStatus, setSelStatus] = useState(null);
  const [pillTime, setPillTime] = useState("12:00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api("/cycles").catch(() => []),
      api("/entries").catch(() => []),
      api("/pills/log/dates").catch(() => ({ dates: [] })),
    ]).then(([c, e, p]) => {
      setCycles(c || []);
      setEntries(e || []);
      setPillDates(p?.dates || []);
    });
  }, [data]);

  const monthList = useMemo(() => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth() - 24, 1);
    if (cycles.length) {
      const minStart = new Date(
        Math.min(...cycles.map((c) => parseISO(c.start_date).getTime()))
      );
      if (minStart < start) {
        start = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
      }
    }
    const end = new Date(now.getFullYear(), now.getMonth() + 18, 1);
    const out = [];
    const cur = new Date(start);
    while (cur <= end) {
      out.push({ y: cur.getFullYear(), m: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [cycles]);

  useEffect(() => {
    if (view !== "month") return;
    const el = document.getElementById(`cal-month-${anchor.y}-${anchor.m}`);
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [view, anchor]);

  const periodDays = useMemo(
    () =>
      data
        ? new Set(Object.keys(data.days).filter((d) => data.days[d] === "period"))
        : new Set(),
    [data]
  );

  const sexDays = useMemo(() => {
    const s = new Set();
    (entries || []).forEach((e) => {
      if (!e.sex) return;
      try {
        const arr = JSON.parse(e.sex);
        if (
          Array.isArray(arr) &&
          arr.some((x) => x && x !== "Dzień bez seksu")
        ) {
          s.add(e.date);
        }
      } catch {
        /* ignore */
      }
    });
    return s;
  }, [entries]);

  const pillSet = useMemo(() => new Set(pillDates || []), [pillDates]);

  if (!data) return <div className="center-screen">Ładowanie…</div>;

  const pred = data.prediction;
  const onPills = !!pred.on_pills;

  function phaseLabel(day) {
    const dayType = data.days[day] || "normal";
    const starts = cycles
      .map((c) => c.start_date)
      .filter((s) => s <= day)
      .sort();
    const dayOfCycle = starts.length
      ? daysBetween(starts[starts.length - 1], day) + 1
      : null;
    const dayStr = dayOfCycle ? `dzień ${dayOfCycle} cyklu` : "cykl";
    if (dayType === "period") return `Okres · ${dayStr}`;
    if (dayType === "ovulation") return `Owulacja · ${dayStr}`;
    if (dayType === "fertile") return `Dni płodne · ${dayStr}`;
    if (dayOfCycle) return `${dayOfCycle}. dzień cyklu`;
    return "Dzień cyklu";
  }

  function openDay(day) {
    setSelected(day);
    setPillTime("12:00");
    setEntry(null);
    setSelStatus(null);
    api(`/entries/${day}`)
      .then(setEntry)
      .catch(() => setEntry(null));
    if (onPills) {
      api(`/pills/log?date=${day}`)
        .then(setSelStatus)
        .catch(() => setSelStatus(null));
    }
  }

  async function markPill() {
    setBusy(true);
    try {
      const s = await api("/pills/log", {
        method: "POST",
        body: { date: selected, time: pillTime },
      });
      setSelStatus(s);
      const p = await api("/pills/log/dates").catch(() => ({ dates: [] }));
      setPillDates(p?.dates || []);
    } catch (err) {
      alert(err.message || "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  }

  async function unmarkPill() {
    setBusy(true);
    try {
      const s = await api("/pills/log", {
        method: "DELETE",
        body: { date: selected },
      });
      setSelStatus(s);
      const p = await api("/pills/log/dates").catch(() => ({ dates: [] }));
      setPillDates(p?.dates || []);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  const syms = (() => {
    try {
      return entry?.symptoms ? JSON.parse(entry.symptoms) : [];
    } catch {
      return [];
    }
  })();
  const mood = entry?.mood ? MOODS.find((m) => m.key === entry.mood) : null;
  const sexItems = (() => {
    try {
      return entry?.sex ? JSON.parse(entry.sex) : [];
    } catch {
      return [];
    }
  })();
  const sexShown = sexItems.filter((x) => x && x !== "Dzień bez seksu");

  return (
    <div className="cal-screen">
      <div className="cal-top">
        <button
          className="cal-close"
          onClick={() => navigate("/")}
          aria-label="Zamknij kalendarz"
        >
          <Icon name="x" size={22} />
        </button>
        <div className="cal-tabs">
          <button
            className={view === "month" ? "on" : ""}
            onClick={() => setView("month")}
          >
            Miesiąc
          </button>
          <button
            className={view === "year" ? "on" : ""}
            onClick={() => setView("year")}
          >
            Rok
          </button>
        </div>
      </div>

      {view === "month" ? (
        <div className="cal-scroll">
          {monthList.map((mn) => {
            const cells = monthCells(mn.y, mn.m);
            return (
              <section
                key={`${mn.y}-${mn.m}`}
                id={`cal-month-${mn.y}-${mn.m}`}
                className="cal-month"
              >
                <div className="cal-month-title">
                  {MONTHS[mn.m]} <span>{mn.y}</span>
                </div>
                <div className="cal-dow-row">
                  {DOW.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="cal-month-grid">
                  {cells.map((c, i) =>
                    c.inMonth ? (
                      <button
                        key={i}
                        className={`cal-sday${c.iso === today ? " today" : ""}${
                          periodDays.has(c.iso) ? " period" : ""
                        }`}
                        onClick={() => openDay(c.iso)}
                        aria-label={formatPL(c.iso)}
                      >
                        <span className="cnum">{c.day}</span>
                        {(sexDays.has(c.iso) || (onPills && pillSet.has(c.iso))) && (
                          <span className="cmark">
                            {sexDays.has(c.iso) && <Icon name="heart" size={9} />}
                            {onPills && pillSet.has(c.iso) && <Icon name="pill" size={9} />}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span key={i} className="cal-empty" />
                    )
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="cal-year-wrap">
          <div className="cal-year-head">
            <button onClick={() => setYear((y) => y - 1)} aria-label="Poprzedni rok">
              <Icon name="chevron-left" size={20} />
            </button>
            <b>{year}</b>
            <button onClick={() => setYear((y) => y + 1)} aria-label="Następny rok">
              <Icon name="chevron-right" size={20} />
            </button>
          </div>
          <div className="cal-year-grid">
            {MONTHS_SHORT.map((mn, i) => {
              const cells = monthCells(year, i).filter((c) => c.inMonth);
              return (
                <button
                  key={i}
                  className="cal-year-month"
                  onClick={() => {
                    setAnchor({ y: year, m: i });
                    setView("month");
                  }}
                >
                  <b>{mn}</b>
                  <div className="cal-year-cells">
                    {cells.map((c) => (
                      <span
                        key={c.iso}
                        className={`ycell${periodDays.has(c.iso) ? " p" : ""}${
                          c.iso === today ? " t" : ""
                        }`}
                      >
                        {c.day}
                        {sexDays.has(c.iso) && <Icon name="heart" size={6} />}
                        {onPills && pillSet.has(c.iso) && <Icon name="pill" size={6} />}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <div className="sheet-mask" onClick={() => setSelected(null)}>
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={formatPL(selected)}
          >
            <div className="sheet-handle" />
            <button
              className="icon-btn sheet-close"
              onClick={() => setSelected(null)}
              aria-label="Zamknij"
            >
              <Icon name="x" size={18} />
            </button>

            <div className="sheet-head">
              <h3>{formatPL(selected)}</h3>
              <span className="tag">{phaseLabel(selected)}</span>
            </div>

            <div className="sheet-row">
              <span className="sr-label">Temperatura</span>
              <span className="sr-value">
                {entry?.temperature ? `${entry.temperature}°C` : "—"}
              </span>
            </div>
            <div className="sheet-row">
              <span className="sr-label">Nastrój</span>
              <span className="sr-value">
                {mood ? `${mood.emoji} ${mood.label}` : "—"}
              </span>
            </div>
            <div className="sheet-row">
              <span className="sr-label">Objawy</span>
              <span className="sr-value">
                {syms.length ? syms.slice(0, 3).join(", ") : "—"}
              </span>
            </div>
            <div className="sheet-row">
              <span className="sr-label">Stosunek</span>
              <span className="sr-value">
                {sexShown.length ? sexShown.join(", ") : "—"}
              </span>
            </div>

            {onPills && selStatus && (
              <div className="sheet-pill">
                <div className="sr-label" style={{ textAlign: "left" }}>
                  Tabletka antykoncepcyjna
                </div>
                {!selStatus.needs_log ? (
                  <div className="sr-value" style={{ textAlign: "left" }}>
                    Dzień przerwy — bez tabletki
                  </div>
                ) : selStatus.taken ? (
                  <>
                    <div className="sr-value" style={{ textAlign: "left" }}>
                      Wzięta o {selStatus.taken_at}
                      {selStatus.late ? (
                        <span className="late"> (spóźniona)</span>
                      ) : (
                        ""
                      )}
                    </div>
                    <button
                      className="sheet-btn soft"
                      onClick={unmarkPill}
                      disabled={busy}
                    >
                      <Icon name="trash" size={16} /> Cofnij tabletkę
                    </button>
                  </>
                ) : (
                  <div className="pill-log-row">
                    <input
                      type="time"
                      className="pc-time"
                      value={pillTime}
                      onChange={(e) => setPillTime(e.target.value)}
                    />
                    <button
                      className="sheet-btn soft"
                      onClick={markPill}
                      disabled={busy}
                      style={{ padding: "10px 14px" }}
                    >
                      <Icon name="check" size={16} /> Wzięłam
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="sheet-actions">
              <button
                className="sheet-btn primary"
                onClick={() =>
                  navigate(
                    `/dziennik${selected === today ? "" : `?date=${selected}`}`
                  )
                }
              >
                <Icon name="pen" size={17} />
                {entry ? "Edytuj wpis" : "Dodaj wpis"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
