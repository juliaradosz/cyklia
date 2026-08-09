import { useEffect, useMemo, useState } from "react";
import { useCalendar, addPeriod, removePeriod } from "../hooks.js";
import { api } from "../api/client.js";
import {
  todayISO,
  parseISO,
  iso,
  addDays,
  monthKey,
  formatPL,
} from "../utils.js";

const DOW = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

export default function CalendarPage() {
  const { data, reload } = useCalendar();
  const today = todayISO();
  const [anchor, setAnchor] = useState(parseISO(today));
  const [cycles, setCycles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ start: today, end: "", flow: 1 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/cycles")
      .then(setCycles)
      .catch(() => {});
  }, [data]);

  const cells = useMemo(() => {
    if (!data) return [];
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // poniedziałek = 0
    const start = addDays(iso(first), -lead);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [anchor, data]);

  if (!data) return <div className="center-screen">Ładowanie…</div>;

  const pred = data.prediction;

  function openAdd(day) {
    setSelected(day);
    setForm({ start: day, end: "", flow: 1 });
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

  async function del(c) {
    await removePeriod(c.id);
    reload();
  }

  function prev() {
    setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
  }
  function next() {
    setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Kalendarz</h1>
          <div className="sub">
            {pred.on_pills ? (
              <>
                Tryb tabletek — okres przewidywany w przerwie:{" "}
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
          <button onClick={prev}>‹</button>
          <b>
            {MONTHS[anchor.getMonth()]} {anchor.getFullYear()}
          </b>
          <button onClick={next}>›</button>
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
            return (
              <div
                key={day}
                className={`cal-day ${type} ${inMonth ? "" : "dim"} ${
                  isToday ? "today" : ""
                }`}
                onClick={() => openAdd(day)}
              >
                {parseInt(day.slice(8), 10)}
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span className="l-period">okres</span>
          {!pred.on_pills && (
            <>
              <span className="l-fertile">dni płodne</span>
              <span className="l-ovulation">owulacja</span>
            </>
          )}
          {pred.on_pills && (
            <span style={{ fontSize: 12 }}>💊 brak owulacji i dni płodnych</span>
          )}
        </div>
      </div>

      <div className="card mt">
        <h2>Twoje okresy</h2>
        {cycles.length === 0 && (
          <p className="muted">
            Brak zapisanych okresów. Kliknij dowolny dzień w kalendarzu, aby go
            dodać.
          </p>
        )}
        {cycles.map((c) => (
          <div key={c.id} className="row mb">
            <span>
              🩸 {formatPL(c.start_date)}
              {c.end_date ? ` → ${formatPL(c.end_date)}` : ""}
            </span>
            <button className="btn small danger" onClick={() => del(c)}>
              Usuń
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <div className="modal-mask" onClick={() => setSelected(null)}>
          <form
            className="card modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={savePeriod}
          >
            <h2>Okres: {formatPL(selected)}</h2>
            <div className="field">
              <label>Data rozpoczęcia</label>
              <input
                type="date"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Data zakończenia (opcjonalnie)</label>
              <input
                type="date"
                value={form.end}
                min={form.start}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Obfitość</label>
              <select
                value={form.flow}
                onChange={(e) => setForm({ ...form, flow: e.target.value })}
              >
                <option value={1}>Skąpy</option>
                <option value={2}>Umiarkowany</option>
                <option value={3}>Obfity</option>
              </select>
            </div>
            <div className="spread">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setSelected(null)}
              >
                Anuluj
              </button>
              <button type="submit" className="btn" disabled={busy}>
                Zapisz
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
