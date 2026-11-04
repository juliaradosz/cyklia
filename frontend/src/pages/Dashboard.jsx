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
import { useEffect, useRef, useState } from "react";
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
  const [patchLog, setPatchLog] = useState(null);
  const [dayStatus, setDayStatus] = useState(null);
  const [pillTimeInput, setPillTimeInput] = useState(nowHM());
  const [editTime, setEditTime] = useState(false);
  const [pillErr, setPillErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [sexSel, setSexSel] = useState([]);
  const [libidoSel, setLibidoSel] = useState("");
  const [periodId, setPeriodId] = useState(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [periodErr, setPeriodErr] = useState("");
  const today = todayISO();
  const [activeDay, setActiveDay] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [slideDir, setSlideDir] = useState("");
  const touchStartX = useRef(null);

  useEffect(() => {
    setActiveDay(today);
    setWeekOffset(0);
    setSlideDir("");
  }, [today, data]);

  useEffect(() => {
    let live = true;
    const method = data?.prediction?.method;
    if (!method || (method !== "pill" && method !== "patch")) {
      setDayStatus(null);
      return () => {};
    }
    api(
      method === "patch"
        ? `/patch/log?date=${activeDay}`
        : `/pills/log?date=${activeDay}`
    )
      .then((s) => live && setDayStatus(s))
      .catch(() => live && setDayStatus(null));
    return () => {
      live = false;
    };
  }, [activeDay, data]);

  useEffect(() => {
    (async () => {
      try {
        const method = data?.prediction?.method;
        const [e, c, ins, pl] = await Promise.all([
          api(`/entries/${today}`).catch(() => null),
          api("/cycles").catch(() => []),
          api("/inspirations").catch(() => []),
          method === "patch"
            ? api("/patch/log").catch(() => null)
            : api("/pills/log").catch(() => null),
        ]);
        setEntry(e);
        setCycles(c || []);
        setInspos(ins || []);
        if (method === "patch") {
          setPillLog(null);
          setPatchLog(pl);
        } else {
          setPillLog(pl);
          setPatchLog(null);
        }
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
  const patchMode = pred.method === "patch";
  const todayType = data.days[today] || "normal";

  const sortedStarts = [...cycles].sort((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );

  const currentPeriod =
    todayType === "period"
      ? sortedStarts.filter((s) => s.start_date <= today).pop() || null
      : null;

  const lastStart = sortedStarts.length ? sortedStarts[sortedStarts.length - 1].start_date : null;

  let cycleLen = pred.cycle_length;
  if (sortedStarts.length >= 2) {
    const a = sortedStarts[sortedStarts.length - 2].start_date;
    const b = sortedStarts[sortedStarts.length - 1].start_date;
    const diff = daysBetween(a, b);
    if (diff > 0) cycleLen = diff;
  }

  const isTodayView = activeDay === today;
  const activeType = data.days[activeDay] || "normal";
  const periodStartDate = sortedStarts.filter((s) => s.start_date <= activeDay).pop();
  const periodDay =
    activeType === "period" && periodStartDate
      ? daysBetween(periodStartDate.start_date, activeDay) + 1
      : null;
  const nextRegStart = sortedStarts.find((s) => s.start_date > activeDay);
  const countdown = nextRegStart
    ? daysBetween(activeDay, nextRegStart.start_date)
    : pred.next_period_start
    ? daysBetween(activeDay, pred.next_period_start)
    : null;

  let phaseLabel;
  let dayLine;
  let noteLine;

  const pillBreakDay =
    onPills && !patchMode && dayStatus?.pack_day != null && dayStatus.pack_day < 0
      ? -dayStatus.pack_day
      : null;

  if (periodDay) {
    phaseLabel = "Okres";
    noteLine = periodDay === 1 ? `Cykl trwał ${cycleLen} dni` : "Okres trwa";
  } else if (pillBreakDay) {
    // w przerwie między blistrami zwykle trwa krwawienie z odstawienia —
    // odliczanie do „następnego okresu” za miesiąc byłoby mylące
    phaseLabel = "Przerwa w tabletkach";
    noteLine = "";
  } else if (countdown !== null) {
    phaseLabel =
      countdown > 0
        ? `${countdown} ${countdown === 1 ? "dzień" : "dni"} do okresu`
        : countdown === 0
        ? "okres — dziś!"
        : `${-countdown} dni po terminie`;
    noteLine = "";
  } else {
    phaseLabel = "Zacznij śledzenie";
    noteLine = "";
  }

  if (periodDay) {
    dayLine = `Dzień ${periodDay}`;
  } else if (patchMode) {
    dayLine = dayStatus?.message || "Plaster";
  } else if (onPills) {
    const pd = dayStatus?.pack_day;
    if (pd == null) dayLine = "Tabletki";
    else if (pd < 0)
      dayLine = `Dzień ${-pd} z ${dayStatus.break_days}${
        dayStatus.next_pack_start ? ` · nowy blister ${dayMonthPL(dayStatus.next_pack_start)}` : ""
      }`;
    else dayLine = `Tabletki — dzień ${pd}${pd === 1 ? " · start pakietu" : ""}`;
  } else {
    dayLine = noteLine || "";
  }

  const week = weekOf(addDays(today, weekOffset * 7));

  function shiftWeek(dir) {
    setWeekOffset((o) => o + dir);
    setActiveDay((d) => addDays(d, dir * 7));
    setSlideDir(dir === 1 ? "right" : "left");
  }

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) < 60) return;
    shiftWeek(dx < 0 ? 1 : -1);
  }

  function openSex() {
    setSheet("sex");
  }

  function openPeriod() {
    if (currentPeriod) {
      setPeriodId(currentPeriod.id);
      setPeriodStart(currentPeriod.start_date);
      setPeriodEnd(currentPeriod.end_date || "");
    } else {
      // brak trwającego okresu → dodawanie nowego (domyślnie wybrany dzień)
      setPeriodId(null);
      setPeriodStart(activeDay <= today ? activeDay : today);
      setPeriodEnd("");
    }
    setPeriodErr("");
    setSheet("period");
  }

  async function endPeriodToday() {
    if (!currentPeriod) return;
    try {
      await api(`/cycles/${currentPeriod.id}`, {
        method: "PATCH",
        body: { end_date: today },
      });
      reload();
    } catch {
      /* ignore */
    }
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
    setPeriodErr("");
    if (!periodStart) {
      setPeriodErr("Wybierz datę początku okresu.");
      return;
    }
    if (periodEnd && periodEnd < periodStart) {
      setPeriodErr("Koniec okresu nie może być przed początkiem.");
      return;
    }
    try {
      if (periodId) {
        await api(`/cycles/${periodId}`, {
          method: "PATCH",
          body: { start_date: periodStart, end_date: periodEnd || null },
        });
      } else {
        await addPeriod(periodStart, periodEnd || undefined, 1);
      }
      setSheet(null);
      reload();
    } catch (err) {
      setPeriodErr(err.message);
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

  async function logPill(newPack = false) {
    if (
      newPack &&
      !window.confirm(
        "Zaczynasz nowy blister już dziś? Cyklia przesunie harmonogram: okres wypadnie kilka dni po ostatniej tabletce z tego blistra."
      )
    )
      return;
    setPillErr("");
    setBusy(true);
    try {
      const pl = await api("/pills/log", {
        method: "POST",
        body: { date: today, time: editTime ? pillTimeInput : nowHM() },
      });
      setPillLog(pl);
      setEditTime(false);
      if (newPack) reload();
    } catch (err) {
      setPillErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function undoPill() {
    setPillErr("");
    try {
      const firstOfPack = pillLog?.pack_day === 1;
      const pl = await api("/pills/log", { method: "DELETE", body: { date: today } });
      setPillLog(pl);
      setPillTimeInput(nowHM());
      if (firstOfPack || pl?.in_break) reload();
    } catch (err) {
      setPillErr(err.message);
    }
  }

  async function applyPatch() {
    try {
      const pl = await api("/patch/log", { method: "POST", body: {} });
      setPatchLog(pl);
    } catch {
      /* ignore */
    }
  }

  async function undoPatch() {
    try {
      const pl = await api("/patch/log", { method: "DELETE", body: {} });
      setPatchLog(pl);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="dash">
      <div className="dash-hero">
        <div className="dash-top">
          <div className="dash-date">
            {(weekOffset !== 0 || activeDay !== today) && (
              <button
                className="btn small ghost today-back"
                onClick={() => {
                  setWeekOffset(0);
                  setActiveDay(today);
                  setSlideDir("");
                }}
              >
                <Icon name="x" size={14} /> dziś
              </button>
            )}
            {dayMonthPL(activeDay)}
          </div>
          <div className="dash-top-right">
            <div className="week-nav">
              <button
                className="week-arrow"
                onClick={() => shiftWeek(-1)}
                aria-label="Poprzedni tydzień"
              >
                <Icon name="chevron-left" size={18} />
              </button>
              <button
                className="week-arrow"
                onClick={() => shiftWeek(1)}
                aria-label="Następny tydzień"
              >
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
            <button
              className="dash-cal"
              onClick={() => navigate("/kalendarz")}
              aria-label="Kalendarz"
            >
              <Icon name="calendar" size={20} />
            </button>
          </div>
        </div>
        <div
          className={`week-row${slideDir ? " slide " + slideDir : ""}`}
          key={weekOffset}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {week.map((d, i) => {
            const isPeriodDay = data.days[d] === "period";
            const isToday = d === today;
            const isActive = d === activeDay;
            const num = Number(d.slice(8, 10));
            return (
              <button
                key={d}
                className={`week-day${isToday ? " today" : ""}${
                  isActive ? " active" : ""
                }`}
                onClick={() => setActiveDay(d)}
                aria-label={dayMonthPL(d)}
              >
                <span className="wd-letter">{WEEK_LETTERS[i]}</span>
                <span className={`wd-num${isPeriodDay ? " period" : ""}`}>
                  {num}
                </span>
              </button>
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
            {currentPeriod ? "Edytuj okres" : "Dodaj okres"}
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

      {isTodayView && !patchMode && onPills && pillLog && (pillLog.needs_log || pillLog.in_break) && (
        <div className={`dash-pill${pillLog.taken ? " done" : ""}${pillLog.late ? " late" : ""}`}>
          <div className="dp-row">
            <div className="dp-ico">
              <Icon name={pillLog.taken ? "check" : "pill"} size={20} />
            </div>
            <div className="dp-body">
              {pillLog.taken ? (
                <>
                  <b>Tabletka wzięta o {pillLog.taken_at}</b>
                  <span className="dp-sub">
                    {pillLog.pack_day > 0
                      ? `Dzień ${pillLog.pack_day} z ${pillLog.active_days}`
                      : "Zapisano"}
                    {pillLog.late ? " · spóźniona" : ""}
                  </span>
                </>
              ) : pillLog.needs_log ? (
                <>
                  <b>Tabletka na dziś</b>
                  <span className="dp-sub">
                    {pillLog.pack_day > 0
                      ? `Dzień ${pillLog.pack_day} z ${pillLog.active_days} · `
                      : ""}
                    zwykle o {pillLog.expected_time}
                  </span>
                </>
              ) : (
                <>
                  <b>Dziś bez tabletki</b>
                  <span className="dp-sub">
                    W przerwie zwykle pojawia się krwawienie.
                    {pillLog.next_pack_start
                      ? ` Nowy blister: ${dayMonthPL(pillLog.next_pack_start)}.`
                      : ""}
                  </span>
                </>
              )}
            </div>
            {pillLog.taken ? (
              <button className="dp-undo" onClick={undoPill}>
                Cofnij
              </button>
            ) : pillLog.needs_log ? (
              <button className="btn small dp-take" disabled={busy} onClick={() => logPill(false)}>
                <Icon name="check" size={16} /> Wzięłam
              </button>
            ) : null}
          </div>

          {pillLog.taken && pillLog.warning && <div className="dp-warn">{pillLog.warning}</div>}

          {!pillLog.taken && pillLog.needs_log && (
            <div className="dp-extra">
              {editTime ? (
                <label className="dp-time">
                  Godzina przyjęcia
                  <input
                    type="time"
                    value={pillTimeInput}
                    onChange={(e) => setPillTimeInput(e.target.value)}
                  />
                </label>
              ) : (
                <button
                  className="dp-link"
                  onClick={() => {
                    setPillTimeInput(nowHM());
                    setEditTime(true);
                  }}
                >
                  Wzięłam o innej godzinie
                </button>
              )}
            </div>
          )}

          {!pillLog.taken && pillLog.in_break && (
            <div className="dp-extra">
              <button className="dp-link" disabled={busy} onClick={() => logPill(true)}>
                Zaczynam nowy blister dziś
              </button>
            </div>
          )}

          {pillErr && <div className="dp-warn">{pillErr}</div>}
        </div>
      )}

      {isTodayView && patchMode && patchLog && (
        <div className="dash-pill">
          <div className="dp-ico">
            <Icon name="pill" size={18} />
          </div>
          {patchLog.needs_change ? (
            patchLog.applied ? (
              <div className="dp-body">
                <b>Odnotowano</b>
                <span className="dp-sub">{patchLog.message}</span>
                <button className="dp-undo" onClick={undoPatch}>
                  Cofnij
                </button>
              </div>
            ) : (
              <div className="dp-body">
                <b>Dziś potrzebny twój plaster</b>
                <span className="dp-sub">{patchLog.message}</span>
                <div className="dp-log">
                  <button className="btn small" onClick={applyPatch}>
                    {patchLog.confirm_label}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="dp-body">
              <b>Plaster antykoncepcyjny</b>
              <span className="dp-sub">{patchLog.message}</span>
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

      {isTodayView && !currentPeriod && (
        <button
          className="btn ghost block mt"
          onClick={async () => {
            await addPeriod(today, undefined, 1);
            reload();
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="droplet" size={17} /> Okres zaczął się dziś
          </span>
        </button>
      )}
      {isTodayView && currentPeriod && !currentPeriod.end_date && (
        <button className="btn ghost block mt" onClick={endPeriodToday}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="check" size={17} /> Okres skończył się dziś
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

      {sheet === "period" && (
        <div className="sheet-overlay" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>{periodId ? "Edytuj okres" : "Dodaj okres"}</b>
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
              min={periodStart || undefined}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
            {periodErr && <div className="error mt">{periodErr}</div>}
            <button className="btn block mt" onClick={savePeriod}>
              {periodId ? "Zapisz zmiany" : "Dodaj okres"}
            </button>
            {periodId && (
              <button className="btn ghost block danger mt" onClick={deletePeriod}>
                Usuń ten okres
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
