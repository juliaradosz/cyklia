import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useCalendar } from "../hooks.js";
import {
  todayISO,
  addDays,
  daysBetween,
  formatPL,
  nowHM,
  MOODS,
  SYMPTOMS,
  LIBIDO,
  MUCUS,
  BLEEDING,
  DIGESTIVE,
  SEX_ACT,
  PHASE_HINTS,
} from "../utils.js";
import Icon from "../components/Icon.jsx";
import { clearCalState } from "../calstate.js";

const EMPTY = {
  temperature: "",
  moods: [],
  symptoms: [],
  notes: "",
  water: 0,
  sleep: "",
  sleep_quality: "",
  steps: "",
  activity: 0,
  libido: "",
  stress: "",
  mucus: "",
  weight: "",
  bleeding: [],
  digestive: [],
  sex: [],
};

const SLEEP_QUALITY = [
  "Bardzo słaba",
  "Słaba",
  "Średnia",
  "Dobra",
  "Bardzo dobra",
];

const POPULAR_SYMPTOMS = [
  "Ból brzucha",
  "Ból piersi",
  "Ból głowy",
  "Ból pleców",
  "Wzdęcia",
  "Trądzik",
  "Mdłości",
  "Zachcianki na słodkie",
  "Niepokój",
  "Płaczliwość",
  "Zmęczenie",
  "Trudności z koncentracją",
];

export default function JournalPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const today = todayISO();
  const initDate = params.get("date") || today;
  const returnTo = params.get("return");
  const [date, setDate] = useState(initDate);
  const [form, setForm] = useState(EMPTY);
  const [entries, setEntries] = useState([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAllSymptoms, setShowAllSymptoms] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [jumpDate, setJumpDate] = useState(today);
  const [pillLog, setPillLog] = useState(null);
  const [patchLog, setPatchLog] = useState(null);
  const [pillTimeInput, setPillTimeInput] = useState(nowHM());
  const [cycles, setCycles] = useState([]);
  const { data: cal } = useCalendar();
  const goBackToCalendarRef = useRef(false);
  const [feel, setFeel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setFeel(null);
    api(`/predict/${date}`)
      .then((r) => {
        if (!cancelled) setFeel(r || { empty: true });
      })
      .catch(() => {
        if (!cancelled) setFeel({ empty: true });
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    return () => {
      // Jeśli wracamy do kalendarza, zostaw zapisany stan; w przeciwnym
      // razie wyczyść go, żeby kalendarz otwierał się zawsze na dziś.
      if (!goBackToCalendarRef.current) {
        clearCalState();
      }
    };
  }, []);

  useEffect(() => {
    api("/cycles")
      .then(setCycles)
      .catch(() => setCycles([]));
  }, []);

  async function loadList() {
    try {
      const rows = await api("/entries");
      setEntries(rows.slice(0, 12));
    } catch {
      setEntries([]);
    }
  }

  async function loadEntry(day) {
    setDate(day);
    setParams(day === today ? {} : { date: day }, { replace: true });
    try {
      const e = await api(`/entries/${day}`);
      if (e) {
        let moods = [];
        if (e.mood) {
          try {
            const p = JSON.parse(e.mood);
            moods = Array.isArray(p) ? p : [e.mood];
          } catch {
            moods = [e.mood];
          }
        }
        setForm({
          temperature: e.temperature ?? "",
          moods,
          symptoms: e.symptoms ? JSON.parse(e.symptoms) : [],
          notes: e.notes ?? "",
          water: e.water ?? 0,
          sleep: e.sleep ?? "",
          sleep_quality: e.sleep_quality ?? "",
          steps: e.steps ?? "",
          activity: e.activity ?? 0,
          libido: e.libido ?? "",
          stress: e.stress ?? "",
          mucus: e.mucus ?? "",
          weight: e.weight ?? "",
          bleeding: e.bleeding ? JSON.parse(e.bleeding) : [],
          digestive: e.digestive ? JSON.parse(e.digestive) : [],
          sex: e.sex ? JSON.parse(e.sex) : [],
        });
      } else {
        setForm(EMPTY);
      }
    } catch {
      setForm(EMPTY);
    }
  }

  useEffect(() => {
    if (!cal || !cal.prediction) return;
    const isPatch = cal.prediction.method === "patch";
    const q = isPatch ? `/patch/log?date=${date}` : `/pills/log?date=${date}`;
    api(q)
      .then((p) => (isPatch ? setPatchLog(p) : setPillLog(p)))
      .catch(() => (isPatch ? setPatchLog(null) : setPillLog(null)));
  }, [cal, date]);

  useEffect(() => {
    loadEntry(initDate);
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSymptom(s) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(s)
        ? f.symptoms.filter((x) => x !== s)
        : [...f.symptoms, s],
    }));
  }

  function toggleMood(k) {
    setForm((f) => ({
      ...f,
      moods: f.moods.includes(k)
        ? f.moods.filter((x) => x !== k)
        : [...f.moods, k],
    }));
  }

  function toggleIn(key, item) {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(item)
        ? f[key].filter((x) => x !== item)
        : [...f[key], item],
    }));
  }

  function setOne(key, item) {
    setForm((f) => ({ ...f, [key]: f[key] === item ? "" : item }));
  }

  function phaseInfo() {
    if (!cal) return PHASE_HINTS.none;
    const onPills = !!cal.prediction.on_pills;
    const dayType = cal.days[date] || "normal";
    if (onPills) {
      return dayType === "period" ? PHASE_HINTS.pills_break : PHASE_HINTS.pills_active;
    }
    if (dayType === "period") return PHASE_HINTS.period;
    if (dayType === "ovulation") return PHASE_HINTS.ovulation;
    if (dayType === "fertile") return PHASE_HINTS.fertile;
    const starts = (cycles || [])
      .map((c) => c.start_date)
      .filter((s) => s <= date)
      .sort();
    if (!starts.length) return PHASE_HINTS.none;
    const cycleDay = daysBetween(starts[starts.length - 1], date) + 1;
    const cycleLen = cal.prediction.cycle_length || 28;
    return cycleDay < cycleLen - 14 ? PHASE_HINTS.follicular : PHASE_HINTS.luteal;
  }

  const hint = phaseInfo();

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/entries/${date}`, {
        method: "PUT",
        body: {
          temperature: form.temperature ? Number(form.temperature) : null,
          mood: form.moods.length ? JSON.stringify(form.moods) : null,
          symptoms: form.symptoms,
          notes: form.notes || null,
          water: form.water ? Number(form.water) : null,
          sleep: form.sleep ? Number(form.sleep) : null,
          sleep_quality: form.sleep_quality || null,
          steps: form.steps ? Number(form.steps) : null,
          activity: form.activity ? Number(form.activity) : null,
          libido: form.libido || null,
          stress: form.stress ? Number(form.stress) : null,
          mucus: form.mucus || null,
          weight: form.weight ? Number(form.weight) : null,
          bleeding: form.bleeding,
          digestive: form.digestive,
          sex: form.sex,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      await loadList();
      if (returnTo === "kalendarz") {
        goBackToCalendarRef.current = true;
        navigate("/kalendarz");
      } else {
        navigate("/");
      }
    } finally {
      setBusy(false);
    }
  }

  function moodEmojis(raw) {
    if (!raw) return "";
    let keys;
    try {
      keys = JSON.parse(raw);
    } catch {
      keys = [raw];
    }
    if (!Array.isArray(keys)) keys = [raw];
    return keys
      .slice(0, 3)
      .map((k) => MOODS.find((m) => m.key === k)?.emoji || "🙂")
      .join(" ");
  }

  const symptomsToShow = showAllSymptoms
    ? SYMPTOMS
    : POPULAR_SYMPTOMS.filter((s) => SYMPTOMS.includes(s));
  const hasMore = symptomsToShow.length < SYMPTOMS.length;

  function prevDay() {
    loadEntry(addDays(date, -1));
  }
  function nextDay() {
    if (date < today) loadEntry(addDays(date, 1));
  }

  async function logPill() {
    try {
      const p = await api("/pills/log", {
        method: "POST",
        body: { date, time: pillTimeInput },
      });
      setPillLog(p);
    } catch {
      /* ignore */
    }
  }

  async function undoPill() {
    try {
      const p = await api("/pills/log", { method: "DELETE", body: { date } });
      setPillLog(p);
    } catch {
      /* ignore */
    }
  }

  async function applyPatch() {
    try {
      const p = await api("/patch/log", {
        method: "POST",
        body: { date },
      });
      setPatchLog(p);
    } catch {
      /* ignore */
    }
  }

  async function undoPatch() {
    try {
      const p = await api("/patch/log", { method: "DELETE", body: { date } });
      setPatchLog(p);
    } catch {
      /* ignore */
    }
  }

  const patchMode = cal?.prediction?.method === "patch";

  function jumpToDay() {
    loadEntry(jumpDate);
    setShowHistory(false);
  }

  return (
    <div>
      <div className="j-topbar">
        <div className="date-nav">
          <button
            className="icon-btn"
            onClick={prevDay}
            aria-label="Poprzedni dzień"
          >
            <Icon name="chevron-left" size={18} />
          </button>
          <div className="date-nav-mid">
            <div className="date-nav-label">Wpis na</div>
            <b>{formatPL(date)}</b>
            {date !== today && (
              <button className="date-nav-today" onClick={() => loadEntry(today)}>
                Dziś
              </button>
            )}
          </div>
          <button
            className={`icon-btn${date >= today ? " disabled" : ""}`}
            onClick={nextDay}
            aria-label="Następny dzień"
          >
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
        <button
          className="icon-btn j-hist-btn"
          onClick={() => setShowHistory(true)}
          aria-label="Zapisane wpisy"
        >
          <Icon name="journal" size={19} />
        </button>
      </div>

      <form onSubmit={save}>
        <div className="j-section hint-card">
          <span className="js-ico h-ico">
            <Icon name={feel ? "sparkles" : hint.icon} size={17} />
          </span>
          <div className="h-body">
            <div className="h-title">
              {date === today ? "Dziś możesz zauważyć" : "W tym dniu możesz zauważyć"}{" "}
              <span className="h-phase">
                · {feel ? (feel.phase_name || hint.title) : hint.title}
              </span>
            </div>
            {feel && feel.empty ? (
              <p className="h-text">
                Zapisuj objawy i nastrój codziennie, a Cyklia nauczy się Twojego
                rytmu i podpowie, co zwykle czujesz w tym momencie cyklu.
              </p>
            ) : feel ? (
              <>
                <p className="h-text">{feel.text}</p>
                {(feel.symptoms.length > 0 || feel.moods.length > 0) && (
                  <div className="h-chips">
                    {feel.symptoms.map((s) => (
                      <span key={s.name} className="h-chip">
                        {s.name} <b className="h-pct">{s.pct}%</b>
                      </span>
                    ))}
                    {feel.moods.map((m) => (
                      <span key={m.name} className="h-chip h-mood">
                        {MOODS.find((x) => x.key === m.name)?.emoji || "•"} {m.name}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="h-text">{hint.text}</p>
                {hint.items.length > 0 && (
                  <div className="h-chips">
                    {hint.items.map((it) => (
                      <span key={it} className="h-chip">
                        {it}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="droplet" size={17} />
            </span>
            <b>Krwawienie</b>
          </div>
          <div className="symptoms-grid">
            {BLEEDING.map((b) => (
              <button
                key={b}
                type="button"
                className={`symptom-chip ${form.bleeding.includes(b) ? "on" : ""}`}
                onClick={() => toggleIn("bleeding", b)}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {patchMode ? (
          patchLog && (
            <div className="j-section">
              <div className="j-sec-head">
                <span className="js-ico">
                  <Icon name="pill" size={17} />
                </span>
                <b>Plaster antykoncepcyjny</b>
              </div>
              {patchLog.needs_change ? (
                patchLog.applied ? (
                  <div className="pill-row">
                    <span className="pill-taken">{patchLog.message}</span>
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={undoPatch}
                    >
                      Cofnij
                    </button>
                  </div>
                ) : (
                  <div className="pill-row">
                    <span className="pill-taken">{patchLog.message}</span>
                    <button
                      type="button"
                      className="btn small"
                      onClick={applyPatch}
                    >
                      {patchLog.confirm_label}
                    </button>
                  </div>
                )
              ) : (
                <div className="pill-taken">{patchLog.message}</div>
              )}
            </div>
          )
        ) : (
          pillLog &&
          pillLog.needs_log && (
            <div className="j-section">
              <div className="j-sec-head">
                <span className="js-ico">
                  <Icon name="pill" size={17} />
                </span>
                <b>Tabletka antykoncepcyjna</b>
              </div>
              {pillLog.taken ? (
                <div className="pill-row">
                  <span className="pill-taken">
                    Wzięta o {pillLog.taken_at}
                    {pillLog.late ? " (spóźniona)" : ""}
                  </span>
                  <button type="button" className="btn small ghost" onClick={undoPill}>
                    Cofnij
                  </button>
                </div>
              ) : (
                <div className="pill-row">
                  <input
                    type="time"
                    className="pc-time"
                    value={pillTimeInput}
                    onChange={(e) => setPillTimeInput(e.target.value)}
                  />
                  <button type="button" className="btn small" onClick={logPill}>
                    Wzięłam
                  </button>
                </div>
              )}
              {pillLog.warning && <div className="pill-warn">{pillLog.warning}</div>}
            </div>
          )
        )}

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="heart" size={17} />
            </span>
            <b>Seks i libido</b>
          </div>
          <div className="sex-grid">
            {SEX_ACT.map((a) => (
              <button
                key={a}
                type="button"
                className={`sex-chip ${form.sex.includes(a) ? "on" : ""}`}
                onClick={() => toggleIn("sex", a)}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="j-sub-label">Libido</div>
          <div className="sex-grid">
            {LIBIDO.map((l) => (
              <button
                key={l}
                type="button"
                className={`sex-chip ${form.libido === l ? "on" : ""}`}
                onClick={() => setOne("libido", l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="sun" size={17} />
            </span>
            <b>Samopoczucie</b>
          </div>
          <div className="mood-grid">
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`mood-opt ${form.moods.includes(m.key) ? "on" : ""}`}
                onClick={() => toggleMood(m.key)}
              >
                <span className="mo-label">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="heart" size={17} />
            </span>
            <b>Objawy</b>
          </div>
          <div className="symptoms-grid">
            {symptomsToShow.map((s) => (
              <button
                key={s}
                type="button"
                className={`symptom-chip ${
                  form.symptoms.includes(s) ? "on" : ""
                }`}
                onClick={() => toggleSymptom(s)}
              >
                {s}
              </button>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              className="show-more"
              onClick={() => setShowAllSymptoms((v) => !v)}
            >
              {showAllSymptoms ? "Pokaż mniej" : "Pokaż więcej"}
            </button>
          )}
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="droplet" size={17} />
            </span>
            <b>Wydzielina</b>
          </div>
          <div className="symptoms-grid">
            {MUCUS.map((m) => (
              <button
                key={m}
                type="button"
                className={`symptom-chip ${form.mucus === m ? "on" : ""}`}
                onClick={() => setOne("mucus", m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="zap" size={17} />
            </span>
            <b>Trawienie</b>
          </div>
          <div className="symptoms-grid">
            {DIGESTIVE.map((d) => (
              <button
                key={d}
                type="button"
                className={`symptom-chip ${form.digestive.includes(d) ? "on" : ""}`}
                onClick={() => toggleIn("digestive", d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="flame" size={17} />
            </span>
            <b>Ciało</b>
          </div>
          <div className="vital-grid">
            <div className="vital-field">
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6, display: "block" }}>
                Poziom stresu
              </label>
              <select
                value={form.stress}
                onChange={(e) =>
                  setForm({ ...form, stress: Number(e.target.value) })
                }
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1 — bardzo niski" : n === 5 ? "5 — bardzo wysoki" : n}
                  </option>
                ))}
              </select>
            </div>
            <div className="vital-field">
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6, display: "block" }}>
                Woda (szklanki)
              </label>
              <div className="stepper">
                <span className="st-label">szkl.</span>
                <div className="st-controls">
                  <button
                    type="button"
                    className="st-btn"
                    onClick={() =>
                      setForm({ ...form, water: Math.max(0, (form.water || 0) - 1) })
                    }
                    aria-label="Mniej"
                  >
                    −
                  </button>
                  <span className="st-value">{form.water || 0}</span>
                  <button
                    type="button"
                    className="st-btn"
                    onClick={() =>
                      setForm({ ...form, water: Math.min(10, (form.water || 0) + 1) })
                    }
                    aria-label="Więcej"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="activity" size={17} />
            </span>
            <b>Ruch i sen</b>
          </div>
          <div className="vital-grid">
            <div className="vital-field">
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6, display: "block" }}>
                Sen (godziny)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="16"
                value={form.sleep}
                onChange={(e) => setForm({ ...form, sleep: e.target.value })}
                placeholder="np. 7.5"
              />
            </div>
            <div className="vital-field">
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6, display: "block" }}>
                Jakość snu
              </label>
              <select
                value={form.sleep_quality}
                onChange={(e) => setForm({ ...form, sleep_quality: e.target.value })}
              >
                <option value="">—</option>
                {SLEEP_QUALITY.map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </select>
            </div>
            <div className="vital-field">
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6, display: "block" }}>
                Kroki
              </label>
              <input
                type="number"
                min="0"
                max="60000"
                value={form.steps}
                onChange={(e) => setForm({ ...form, steps: e.target.value })}
                placeholder="np. 8000"
              />
            </div>
            <div className="vital-field">
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6, display: "block" }}>
                Aktywność (min)
              </label>
              <input
                type="number"
                min="0"
                max="600"
                value={form.activity}
                onChange={(e) =>
                  setForm({ ...form, activity: e.target.value })
                }
                placeholder="np. 45"
              />
            </div>
          </div>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="thermometer" size={17} />
            </span>
            <b>Temperatura i waga</b>
          </div>
          <div className="vital-grid">
            <div className="vital-field">
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6, display: "block" }}>
                Temperatura bazowa (°C)
              </label>
              <input
                type="number"
                step="0.01"
                min="35"
                max="41"
                value={form.temperature}
                onChange={(e) =>
                  setForm({ ...form, temperature: e.target.value })
                }
                placeholder="np. 36.60"
              />
            </div>
            <div className="vital-field">
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6, display: "block" }}>
                Waga (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="200"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="np. 62.5"
              />
            </div>
          </div>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="pen" size={17} />
            </span>
            <b>Notatka</b>
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Jak się czujesz? Co Cię cieszyło lub męczyło?"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line-strong)", borderRadius: 14, padding: 13, width: "100%", minHeight: 84, outline: "none", fontSize: 14 }}
          />
        </div>

        <div className="j-sticky">
          <button className="btn block" disabled={busy}>
            {busy
              ? "Zapisywanie…"
              : saved
              ? "Zapisano ✓"
              : `Zapisz wpis · ${formatPL(date).split(",")[1] || date}`}
          </button>
          {saved && <div className="j-saved-note">Wpis zapisany. Dziękuję! 💗</div>}
        </div>
      </form>

      {showHistory && (
        <div className="sheet-overlay" onClick={() => setShowHistory(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>Zapisane wpisy</b>
              <button
                className="icon-btn"
                onClick={() => setShowHistory(false)}
                aria-label="Zamknij"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <label className="sheet-lbl">Przejdź do dnia</label>
            <div className="jump-row">
              <input
                type="date"
                className="sheet-input"
                value={jumpDate}
                max={today}
                onChange={(e) => setJumpDate(e.target.value)}
              />
              <button className="btn small" onClick={jumpToDay}>
                Pokaż
              </button>
            </div>
            <div className="sheet-sub">Historia wpisów</div>
            <div className="hist-list">
              {entries.length === 0 && (
                <p className="muted" style={{ padding: "10px 0" }}>
                  Brak zapisanych wpisów.
                </p>
              )}
              {entries.map((e) => {
                const syms = (() => {
                  try {
                    return JSON.parse(e.symptoms || "[]");
                  } catch {
                    return [];
                  }
                })();
                return (
                  <div
                    key={e.date}
                    className="entry-row"
                    onClick={() => {
                      loadEntry(e.date);
                      setShowHistory(false);
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="er-date">{formatPL(e.date)}</div>
                      <div className="er-sub">
                        {moodEmojis(e.mood) || "brak nastroju"}
                        {e.temperature ? ` · ${e.temperature}°C` : ""}
                        {syms.length ? ` · ${syms.slice(0, 3).join(", ")}` : ""}
                      </div>
                    </div>
                    <span className="icon-btn er-edit" style={{ width: 34, height: 34 }}>
                      <Icon name="pen" size={15} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
