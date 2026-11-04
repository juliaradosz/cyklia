import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCalendar } from "../hooks.js";
import { useAuth } from "../api/auth.jsx";
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
import { saveCalState, takeCalState, clearCalState } from "../calstate.js";

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
  const { user } = useAuth();
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
  const leavingToJournalRef = useRef(false);

  useEffect(() => {
    return () => {
      // Opuszczając kalendarz w dowolne inne miejsce (poza przejściem do
      // dziennika) czyścimy zapisany stan — kolejne otwarcie zaczyna od dziś.
      if (!leavingToJournalRef.current) {
        clearCalState();
      }
    };
  }, []);

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
    const saved = takeCalState();
    if (!saved) return;
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

  // prognozowany okres (kolejne 3 cykle) — tylko dni, które nie są już okresem
  const predictedDays = useMemo(() => {
    const s = new Set();
    const p = data?.prediction;
    if (!p?.next_period_start) return s;
    const per = Math.max(1, Number(p.period_length) || 5);
    const len = Math.max(14, Number(p.cycle_length) || 28);
    for (let c = 0; c < 3; c++) {
      const start = addDays(p.next_period_start, c * len);
      for (let i = 0; i < per; i++) {
        const d = addDays(start, i);
        if (d >= todayISO() && !periodDays.has(d)) s.add(d);
      }
    }
    return s;
  }, [data, periodDays]);

  const sexDays = useMemo(() => {
    const s = new Set();
    (entries || []).forEach((e) => {
      if (!e.sex) return;
      try {
        const arr = JSON.parse(e.sex);
        if (
          Array.isArray(arr) &&
          arr.some(
            (x) =>
              x === "Seks z zabezpieczeniem" ||
              x === "Seks bez zabezpieczenia"
          )
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

  const patchDays = useMemo(() => {
    const s = new Set();
    (cycles || []).forEach((c) => {
      const st = c.start_date;
      s.add(st);
      s.add(addDays(st, 7));
      s.add(addDays(st, 14));
    });
    return s;
  }, [cycles]);

  if (!data) return <div className="center-screen">Ładowanie…</div>;

  const pred = data.prediction;
  const onPills = !!pred.on_pills;
  const patchMode = pred.method === "patch";

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
    if (predictedDays.has(day)) return "Prognozowany okres";
    if (dayType === "ovulation") return `Owulacja · ${dayStr}`;
    if (dayType === "fertile") return `Dni płodne · ${dayStr}`;
    if (dayOfCycle) return `${dayOfCycle}. dzień cyklu`;
    return "Dzień cyklu";
  }

  function dayClass(day) {
    if (periodDays.has(day)) return " period";
    if (predictedDays.has(day)) return " predicted";
    const t = data.days[day];
    if (t === "ovulation") return " ovulation";
    if (t === "fertile") return " fertile";
    return "";
  }

  function openDay(day) {
    setSelected(day);
    setPillTime(user?.pill_time || "12:00");
    setEntry(null);
    setSelStatus(null);
    api(`/entries/${day}`)
      .then(setEntry)
      .catch(() => setEntry(null));
    if (patchMode) {
      api(`/patch/log?date=${day}`)
        .then(setSelStatus)
        .catch(() => setSelStatus(null));
    } else if (onPills) {
      api(`/pills/log?date=${day}`)
        .then(setSelStatus)
        .catch(() => setSelStatus(null));
    }
  }

  function goAddSymptoms() {
    if (!selected) return;
    leavingToJournalRef.current = true;
    saveCalState({
      view,
      anchor,
      year,
      scrollTop:
        view === "month"
          ? scrollRef.current?.scrollTop ?? 0
          : document.querySelector(".cal-year-wrap")?.scrollTop ?? 0,
    });
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
      reload();
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
      reload();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function markPatch() {
    setBusy(true);
    try {
      const s = await api("/patch/log", {
        method: "POST",
        body: { date: selected },
      });
      setSelStatus(s);
    } catch (err) {
      alert(err.message || "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  }

  async function unmarkPatch() {
    setBusy(true);
    try {
      const s = await api("/patch/log", {
        method: "DELETE",
        body: { date: selected },
      });
      setSelStatus(s);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  // okres (zarejestrowany), do którego należy wybrany dzień
  const selectedCycle = selected
    ? [...cycles]
        .filter((c) => c.start_date <= selected)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .pop() || null
    : null;

  async function deleteSelectedPeriod() {
    if (!selectedCycle) return;
    if (!window.confirm(`Usunąć okres rozpoczęty ${formatPL(selectedCycle.start_date)}?`)) return;
    setBusy(true);
    try {
      await api(`/cycles/${selectedCycle.id}`, { method: "DELETE" });
      const c = await api("/cycles").catch(() => []);
      setCycles(c || []);
      reload();
    } catch (err) {
      alert(err.message || "Nie udało się usunąć");
    } finally {
      setBusy(false);
    }
  }

  async function markPeriodEnd() {
    if (!selectedCycle) return;
    setBusy(true);
    try {
      await api(`/cycles/${selectedCycle.id}`, {
        method: "PATCH",
        body: { end_date: selected },
      });
      reload();
    } catch (err) {
      alert(err.message || "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  }

  async function markPeriodStart() {
    if (!selected) return;
    setBusy(true);
    try {
      const per = Math.max(1, Number(user?.period_length_default) || 5);
      await api("/cycles", {
        method: "POST",
        body: {
          start_date: selected,
          end_date: addDays(selected, per - 1),
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

      <div className="cal-legend">
        <span><i className="lg period" /> Okres</span>
        <span><i className="lg predicted" /> Prognoza</span>
        {!onPills && <span><i className="lg fertile" /> Dni płodne</span>}
        {!onPills && <span><i className="lg ovulation" /> Owulacja</span>}
        {onPills && <span><Icon name="pill" size={10} className="picon" /> Tabletka</span>}
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
                        className={`cal-sday${c.iso === today ? " today" : ""}${dayClass(c.iso)}`}
                        onClick={() => openDay(c.iso)}
                        aria-label={formatPL(c.iso)}
                      >
                        <span className="cnum">{c.day}</span>
                        <span className="cmark">
                          {sexDays.has(c.iso) && (
                            <Icon name="heart" size={9} filled className="hicon" />
                          )}
                          {patchMode
                            ? patchDays.has(c.iso) && (
                                <Icon name="pill" size={9} className="picon" />
                              )
                            : onPills &&
                              pillSet.has(c.iso) && (
                                <Icon name="pill" size={9} className="picon" />
                              )}
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
                            predictedDays.has(c.iso) ? " pp" : ""
                          }${
                            data.days[c.iso] === "fertile" || data.days[c.iso] === "ovulation" ? " f" : ""
                          }${c.iso === today ? " t" : ""}`}
                        >
                          <span className="ynum">{c.day}</span>
                          <span className="ymark">
                            {sexDays.has(c.iso) && (
                              <Icon name="heart" size={6} filled className="hicon" />
                            )}
                            {patchMode
                              ? patchDays.has(c.iso) && (
                                  <Icon name="pill" size={6} className="picon" />
                                )
                              : onPills &&
                                pillSet.has(c.iso) && (
                                  <Icon name="pill" size={6} className="picon" />
                                )}
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

            {selected > today ? (
              <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
                To dzień w przyszłości
                {predictedDays.has(selected) ? " — prognozowany okres." : "."} Okres
                zaznaczysz, gdy się zacznie.
              </p>
            ) : selectedIsPeriod && selectedCycle ? (
              <div className="sheet-actions">
                {selected !== selectedCycle.start_date &&
                  selected !== selectedCycle.end_date && (
                    <button className="sheet-btn soft" onClick={markPeriodEnd} disabled={busy}>
                      <Icon name="check" size={16} /> Okres skończył się tego dnia
                    </button>
                  )}
                <button className="sheet-btn danger" onClick={deleteSelectedPeriod} disabled={busy}>
                  <Icon name="trash" size={16} /> Usuń ten okres
                </button>
              </div>
            ) : (
              <button
                className="sheet-btn soft"
                onClick={markPeriodStart}
                disabled={busy}
                style={{ marginBottom: 10 }}
              >
                <Icon name="droplet" size={17} /> Okres zaczął się tego dnia
              </button>
            )}

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

            {!patchMode && onPills && selStatus && (
              <div className="sheet-pill">
                <div className="sr-label" style={{ textAlign: "left" }}>
                  Tabletka antykoncepcyjna
                </div>
                {!selStatus.needs_log ? (
                  <>
                    <div className="sr-value" style={{ textAlign: "left" }}>
                      Dzień przerwy — bez tabletki
                    </div>
                    {selected <= today && (
                      <div className="pill-log-row">
                        <input
                          type="time"
                          className="pc-time"
                          value={pillTime}
                          onChange={(e) => setPillTime(e.target.value)}
                        />
                        <button
                          className="sheet-btn soft"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Zaczęłaś nowy blister tego dnia? Harmonogram i prognoza okresu przesuną się."
                              )
                            )
                              markPill();
                          }}
                          disabled={busy}
                          style={{ padding: "10px 14px" }}
                        >
                          <Icon name="pill" size={16} /> Nowy blister
                        </button>
                      </div>
                    )}
                  </>
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
                ) : selected > today ? (
                  <div className="sr-value" style={{ textAlign: "left" }}>
                    Dzień z tabletką
                    {selStatus.pack_day > 0 ? ` (${selStatus.pack_day}. w blistrze)` : ""}
                  </div>
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

            {patchMode && selStatus && (
              <div className="sheet-pill">
                <div className="sr-label" style={{ textAlign: "left" }}>
                  Plaster antykoncepcyjny
                </div>
                {selStatus.needs_change ? (
                  selStatus.applied ? (
                    <>
                      <div className="sr-value" style={{ textAlign: "left" }}>
                        {selStatus.message}
                      </div>
                      <button
                        className="sheet-btn soft"
                        onClick={unmarkPatch}
                        disabled={busy}
                      >
                        <Icon name="trash" size={16} /> Cofnij
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="sr-value" style={{ textAlign: "left" }}>
                        {selStatus.message}
                      </div>
                      <button
                        className="sheet-btn soft"
                        onClick={markPatch}
                        disabled={busy}
                        style={{ padding: "10px 14px" }}
                      >
                        <Icon name="check" size={16} /> {selStatus.confirm_label}
                      </button>
                    </>
                  )
                ) : (
                  <div className="sr-value" style={{ textAlign: "left" }}>
                    {selStatus.message}
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
