import { useEffect, useMemo, useRef, useState } from "react";
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
  WEEK_LETTERS,
} from "../utils.js";
import Icon from "../components/Icon.jsx";

const RETURN_KEY = "cyklia_cal_return";

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
  const scrollRef = useRef(null);
  const restoreScrollRef = useRef(null);

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
    const el = scrollRef.current;
    if (!el) return;
    const target = document.getElementById(`cal-month-${anchor.y}-${anchor.m}`);
    if (target) {
      el.scrollTo({ top: Math.max(0, target.offsetTop), behavior: "auto" });
    }
  }, [view, anchor.y, anchor.m, data]);

  useEffect(() => {
    let saved = null;
    try {
      const raw = sessionStorage.getItem(RETURN_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    if (!saved) return;
    sessionStorage.removeItem(RETURN_KEY);
    if (saved.view) setView(saved.view);
    if (saved.anchor) setAnchor(saved.anchor);
    if (saved.year) setYear(saved.year);
    if (typeof saved.scrollTop === "number") restoreScrollRef.current = saved.scrollTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = restoreScrollRef.current;
    if (saved == null) return;
    const el =
      view === "month"
        ? scrollRef.current
        : document.querySelector(".cal-year-wrap");
    if (!el) return;
    el.scrollTop = saved;
    restoreScrollRef.current = null;
  }, [view, data]);

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

  function goAddSymptoms() {
    if (!selected) return;
    try {
      sessionStorage.setItem(
        RETURN_KEY,
        JSON.stringify({
          view,
          anchor,
          year,
          scrollTop:
            view === "month"
              ? scrollRef.current?.scrollTop ?? 0
              : document.querySelector(".cal-year-wrap")?.scrollTop ?? 0,
        })
      );
    } catch {
      /* ignore */
    }
    const q = new URLSearchParams();
    if (selected !== today) q.set("date", selected);
    q.set("return", "kalendarz");
    navigate(`/dziennik?${q.toString()}`);
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

  async function markPeriodStart() {
    if (!selected) return;
    setBusy(true);
    try {
      await api("/cycles", {
        method: "POST",
        body: {
          start_date: selected,
          end_date: addDays(selected, 4),
        },
      });
      const c = await api("/cycles").catch(() => []);
      setCycles(c || []);
      reload();
    } catch (err) {
      alert(err.message || "Nie udało się zapisać");
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
  const moods = (() => {
    if (!entry?.mood) return [];
    let keys;
    try {
      keys = JSON.parse(entry.mood);
    } catch {
      keys = null;
    }
    if (!Array.isArray(keys)) keys = [entry.mood];
    return keys
      .map((k) => MOODS.find((m) => m.key === k))
      .filter(Boolean);
  })();
  const sexItems = (() => {
    try {
      return entry?.sex ? JSON.parse(entry.sex) : [];
    } catch {
      return [];
    }
  })();
  const sexShown = sexItems.filter((x) => x && x !== "Dzień bez seksu");
  const selectedIsPeriod = selected ? periodDays.has(selected) : false;

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
        <div className="cal-scroll" ref={scrollRef}>
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
                        <span className="cmark">
                          {sexDays.has(c.iso) && <Icon name="heart" size={9} filled />}
                          {onPills && pillSet.has(c.iso) && <Icon name="pill" size={9} />}
                        </span>
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
              const all = monthCells(year, i);
              const last = all.map((c) => c.inMonth).lastIndexOf(true);
              const cells = all.slice(0, last + 1);
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
                  <div className="cal-year-dow">
                    {WEEK_LETTERS.map((d, di) => (
                      <span key={di}>{d}</span>
                    ))}
                  </div>
                  <div className="cal-year-cells">
                    {cells.map((c) =>
                      c.inMonth ? (
                        <span
                          key={c.iso}
                          className={`ycell${periodDays.has(c.iso) ? " p" : ""}${
                            c.iso === today ? " t" : ""
                          }`}
                        >
                          <span className="ynum">{c.day}</span>
                          <span className="ymark">
                            {sexDays.has(c.iso) && <Icon name="heart" size={6} filled />}
                            {onPills && pillSet.has(c.iso) && <Icon name="pill" size={6} />}
                          </span>
                        </span>
                      ) : (
                        <span key={c.iso} className="ycell empty" />
                      )
                    )}
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
              <div className="sh-info">
                <h3>{formatPL(selected)}</h3>
                <span className="tag">{phaseLabel(selected)}</span>
              </div>
              <button
                className="sh-add"
                onClick={goAddSymptoms}
                aria-label="Dodaj lub edytuj wpis"
              >
                <Icon name="plus" size={20} />
              </button>
            </div>

            <button
              className={`sheet-btn ${selectedIsPeriod ? "done" : "soft"}`}
              onClick={markPeriodStart}
              disabled={busy || selectedIsPeriod}
              style={{ marginBottom: 10 }}
            >
              <Icon name={selectedIsPeriod ? "check" : "droplet"} size={17} />
              {selectedIsPeriod
                ? "Ten dzień jest oznaczony jako okres"
                : "Okres zaczął się tego dnia"}
            </button>

            <div className="sheet-row">
              <span className="sr-label">Objawy</span>
              <div className="sr-side">
                <span className="sr-value">
                  {syms.length ? syms.slice(0, 4).join(", ") : "—"}
                </span>
                <button
                  className="sr-add"
                  onClick={goAddSymptoms}
                  aria-label="Dodaj objawy"
                >
                  <Icon name="plus" size={16} />
                </button>
              </div>
            </div>
            <div className="sheet-row">
              <span className="sr-label">Obserwacje</span>
              <span className="sr-value">
                {entry?.notes ? entry.notes.slice(0, 48) + (entry.notes.length > 48 ? "…" : "") : "—"}
              </span>
            </div>
            <div className="sheet-row">
              <span className="sr-label">Aktywność</span>
              <span className="sr-value">
                {entry?.activity ? `${entry.activity} min` : "—"}
              </span>
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
                {moods.length
                  ? moods.map((m) => `${m.emoji} ${m.label}`).join(", ")
                  : "—"}
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
          </div>
        </div>
      )}
    </div>
  );
}
