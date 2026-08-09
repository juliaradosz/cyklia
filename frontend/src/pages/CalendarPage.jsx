import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCalendar, addPeriod, removePeriod } from "../hooks.js";
import { api } from "../api/client.js";
import {
  todayISO,
  parseISO,
  iso,
  addDays,
  daysBetween,
  monthKey,
  formatPL,
  MOODS,
} from "../utils.js";
import Icon from "../components/Icon.jsx";

const DOW = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

export default function CalendarPage() {
  const { data, reload } = useCalendar();
  const navigate = useNavigate();
  const today = todayISO();
  const [anchor, setAnchor] = useState(parseISO(today));
  const [cycles, setCycles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [entry, setEntry] = useState(null);
  const [form, setForm] = useState({ start: today, end: "", flow: 1 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/cycles")
      .then(setCycles)
      .catch(() => {});
  }, [data]);

  useEffect(() => {
    if (!selected) {
      setEntry(null);
      return;
    }
    setEntry(null);
    api(`/entries/${selected}`)
      .then(setEntry)
      .catch(() => setEntry(null));
  }, [selected, data]);

  const cells = useMemo(() => {
    if (!data) return [];
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // poniedziałek = 0
    const start = addDays(iso(first), -lead);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [anchor, data]);

  if (!data) return <div className="center-screen">Ładowanie…</div>;

  const pred = data.prediction;
  const onPills = !!pred.on_pills;

  function openDay(day) {
    const c = cycles.find((x) => x.start_date === day);
    setForm({ start: day, end: c?.end_date || "", flow: c?.flow_level || 1 });
    setSelected(day);
  }

  async function savePeriod(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await addPeriod(form.start, form.end || undefined, Number(form.flow));
      setSelected(null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    const c = cycles.find((x) => x.start_date === selected);
    if (c) await removePeriod(c.id);
    setSelected(null);
    reload();
  }

  function prev() {
    setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
  }
  function next() {
    setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
  }

  const existingPeriod = selected
    ? cycles.find((x) => x.start_date === selected)
    : null;

  const syms = (() => {
    try {
      return entry?.symptoms ? JSON.parse(entry.symptoms) : [];
    } catch {
      return [];
    }
  })();
  const mood = entry?.mood
    ? MOODS.find((m) => m.key === entry.mood)
    : null;

  function phaseLabel(day) {
    const t = data.days[day] || "normal";
    const starts = cycles
      .map((c) => c.start_date)
      .filter((s) => s <= day)
      .sort();
    const dayOfCycle = starts.length
      ? daysBetween(starts[starts.length - 1], day) + 1
      : null;
    const dayStr = dayOfCycle ? `dzień ${dayOfCycle} cyklu` : "cykl";
    if (t === "period") return `Okres · ${dayStr}`;
    if (t === "ovulation") return `Owulacja · ${dayStr}`;
    if (t === "fertile") return `Dni płodne · ${dayStr}`;
    if (dayOfCycle) return `${dayOfCycle}. dzień cyklu`;
    return "Dzień cyklu";
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Kalendarz</h1>
          <div className="sub">
            {onPills ? (
              <>
                Okres przewidywany w przerwie:{" "}
                {pred.next_period_start
                  ? formatPL(pred.next_period_start)
                  : "dodaj pierwszy okres"}
              </>
            ) : pred.has_data ? (
              <>
                Kolejny okres:{" "}
                {pred.next_period_start
                  ? formatPL(pred.next_period_start)
                  : "—"}
              </>
            ) : (
              "Zaznacz okres, a Cyklia przewidzi owulację i dni płodne"
            )}
          </div>
        </div>
      </div>

      <div className="cal-wrap">
        <div className="cal-head">
          <button onClick={prev} aria-label="Poprzedni miesiąc">
            <Icon name="chevron-left" size={18} />
          </button>
          <b>
            {MONTHS[anchor.getMonth()]} {anchor.getFullYear()}
          </b>
          <button onClick={next} aria-label="Następny miesiąc">
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
        <div className="cal-grid">
          {DOW.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {cells.map((day) => {
            const type = data.days[day] || "normal";
            const inMonth = monthKey(parseISO(day)) === monthKey(anchor);
            const isToday = day === today;
            const isSel = day === selected;
            return (
              <div
                key={day}
                className={`cal-day ${inMonth ? "" : "dim"} ${
                  isToday ? "today" : ""
                } ${isSel ? "sel" : ""}`}
                onClick={() => openDay(day)}
                aria-label={formatPL(day)}
              >
                <span className="day-num">{parseInt(day.slice(8), 10)}</span>
                {type !== "normal" && (
                  <span className={`cal-dot ${type}`} />
                )}
                {onPills && (
                  <span className="cal-dot pill" />
                )}
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span className="l-period">okres</span>
          {!onPills && (
            <>
              <span className="l-fertile">dni płodne</span>
              <span className="l-ovulation">owulacja</span>
            </>
          )}
        </div>
      </div>

      <div className="section-head">
        <h2>Okresy</h2>
      </div>
      {cycles.length === 0 ? (
        <div className="card">
          <p className="muted">
            Brak zapisanych okresów. Kliknij dowolny dzień w kalendarzu, aby go
            dodać.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: "6px 18px" }}>
          {cycles.map((c) => (
            <div key={c.id} className="entry-row">
              <span className="er-date" style={{ fontSize: 13.5 }}>
                {formatPL(c.start_date)}
                {c.end_date ? ` → ${formatPL(c.end_date)}` : ""}
              </span>
              <button
                className="icon-btn er-edit"
                style={{ width: 34, height: 34 }}
                onClick={() => {
                  openDay(c.start_date);
                }}
                aria-label="Edytuj okres"
              >
                <Icon name="pen" size={15} />
              </button>
              <button
                className="icon-btn"
                style={{ width: 34, height: 34, color: "var(--red)" }}
                onClick={async () => {
                  await removePeriod(c.id);
                  reload();
                }}
                aria-label="Usuń okres"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
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
              <span className="sr-label">Notatka</span>
              <span className="sr-value">
                {entry?.notes ? entry.notes.slice(0, 40) : "—"}
              </span>
            </div>

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

              {existingPeriod ? (
                <form onSubmit={savePeriod}>
                  <div className="field">
                    <label>Obfitość tego okresu</label>
                    <select
                      value={form.flow}
                      onChange={(e) =>
                        setForm({ ...form, flow: e.target.value })
                      }
                    >
                      <option value={1}>Skąpy</option>
                      <option value={2}>Umiarkowany</option>
                      <option value={3}>Obfity</option>
                    </select>
                  </div>
                  <button className="sheet-btn soft" disabled={busy}>
                    <Icon name="check" size={17} /> Zapisz zmiany
                  </button>
                  <button
                    type="button"
                    className="sheet-btn danger"
                    onClick={del}
                    style={{ marginTop: 8 }}
                  >
                    <Icon name="trash" size={16} /> Usuń ten okres
                  </button>
                </form>
              ) : (
                <form onSubmit={savePeriod}>
                  <div className="field">
                    <label>Koniec okresu (opcjonalnie)</label>
                    <input
                      type="date"
                      value={form.end}
                      min={form.start}
                      onChange={(e) =>
                        setForm({ ...form, end: e.target.value })
                      }
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Obfitość</label>
                    <select
                      value={form.flow}
                      onChange={(e) =>
                        setForm({ ...form, flow: e.target.value })
                      }
                    >
                      <option value={1}>Skąpy</option>
                      <option value={2}>Umiarkowany</option>
                      <option value={3}>Obfity</option>
                    </select>
                  </div>
                  <button
                    className="sheet-btn soft"
                    disabled={busy}
                    style={{ marginTop: 10 }}
                  >
                    <Icon name="calendar" size={16} /> Zaznacz okres
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
