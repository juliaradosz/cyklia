import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";
import { api } from "../api/client.js";
import Icon from "../components/Icon.jsx";

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState("home");
  const [name, setName] = useState(user?.display_name || "");
  const [cycle, setCycle] = useState(user?.cycle_length_default || 28);
  const [period, setPeriod] = useState(user?.period_length_default || 5);
  const [method, setMethod] = useState(
    user?.patch_mode ? "patch" : user?.pill_mode ? "pill" : "none"
  );
  const pillMode = method === "pill";
  const patchMode = method === "patch";
  const [pills, setPills] = useState([]);
  const [patchesData, setPatchesData] = useState(null);
  const [pillName, setPillName] = useState(user?.pill_name || "");
  const [patchName, setPatchName] = useState(user?.patch_name || "");
  const [pillCycle, setPillCycle] = useState(user?.pill_cycle_days || 21);
  const [pillBreak, setPillBreak] = useState(user?.pill_break_days || 7);
  const [pillTime, setPillTime] = useState(user?.pill_time || "12:00");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api("/pills")
      .then(setPills)
      .catch(() => {});
    api("/patches")
      .then(setPatchesData)
      .catch(() => {});
  }, []);

  function choosePill(name) {
    setPillName(name);
    const p = pills.find((x) => x.name === name);
    if (p) {
      setPillCycle(p.active);
      setPillBreak(p.break);
    }
  }

  function choosePatch(name) {
    setPatchName(name);
  }

  async function save(extra = {}) {
    await api("/me", {
      method: "PATCH",
      body: {
        display_name: name,
        cycle_length_default: Number(cycle),
        period_length_default: Number(period),
        pill_mode: pillMode,
        pill_name: pillMode ? pillName : "",
        pill_cycle_days: pillMode ? Number(pillCycle) : 21,
        pill_break_days: pillMode ? Number(pillBreak) : 7,
        pill_time: pillMode ? pillTime : "12:00",
        patch_mode: patchMode,
        patch_name: patchMode ? patchName : "",
        ...extra,
      },
    });
    updateUser({
      display_name: name,
      cycle_length_default: Number(cycle),
      period_length_default: Number(period),
      pill_mode: pillMode,
      pill_name: pillMode ? pillName : "",
      pill_cycle_days: pillMode ? Number(pillCycle) : 21,
      pill_break_days: pillMode ? Number(pillBreak) : 7,
      pill_time: pillMode ? pillTime : "12:00",
      patch_mode: patchMode,
      patch_name: patchMode ? patchName : "",
      ...extra,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function logoutNow() {
    logout();
    navigate("/login");
  }

  const initial = (user?.display_name || user?.email || "?")[0] || "?";

  if (view === "cycle") {
    return (
      <div>
        <div className="sub-screen-head">
          <button className="icon-btn" onClick={() => setView("home")} aria-label="Wróć">
            <Icon name="chevron-left" size={20} />
          </button>
          <h1>Cykl i okres</h1>
        </div>

        <div className="j-section">
          <p className="muted" style={{ marginTop: 0 }}>
            Ustawienia naturalnego cyklu, używane, gdy nie przyjmujesz
            antykoncepcji hormonalnej.
          </p>
          <div className="vital-grid">
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Długość cyklu (dni)</label>
              <input
                type="number"
                min="14"
                max="60"
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Długość okresu (dni)</label>
              <input
                type="number"
                min="1"
                max="14"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
          </div>
        </div>

        <button className="btn block" onClick={() => save()}>
          {saved ? "✓ Zapisano" : "Zapisz ustawienia"}
        </button>
      </div>
    );
  }

  if (view === "pill") {
    return (
      <div>
        <div className="sub-screen-head">
          <button className="icon-btn" onClick={() => setView("home")} aria-label="Wróć">
            <Icon name="chevron-left" size={20} />
          </button>
          <h1>Antykoncepcja</h1>
        </div>

        <div className="settings-group" style={{ padding: 0 }}>
          <div className="set-switch">
            <span className="sw-label">Jak się zabezpieczasz?</span>
          </div>
          <div className="method-grid">
            <button
              className={`method-chip${method === "none" ? " on" : ""}`}
              onClick={() => setMethod("none")}
            >
              Bez hormonów
            </button>
            <button
              className={`method-chip${method === "pill" ? " on" : ""}`}
              onClick={() => setMethod("pill")}
            >
              Tabletki
            </button>
            <button
              className={`method-chip${method === "patch" ? " on" : ""}`}
              onClick={() => setMethod("patch")}
            >
              Plastry
            </button>
          </div>
        </div>

        {pillMode && (
          <div className="j-section">
            <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
              W trybie tabletek kalendarz nie pokazuje owulacji ani dni
              płodnych, a kolejny okres przewiduje w przerwie między blistrami.
            </p>
            <div className="field">
              <label>Twój środek (opcjonalnie)</label>
              <select
                value={pillName}
                onChange={(e) => choosePill(e.target.value)}
              >
                <option value="">Wybierz z listy lub ustaw ręcznie…</option>
                {pills.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.active}+{p.break})
                  </option>
                ))}
              </select>
            </div>
            <div className="vital-grid">
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Dni przyjmowania</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={pillCycle}
                  onChange={(e) => setPillCycle(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Dni przerwy</label>
                <input
                  type="number"
                  min="0"
                  max="14"
                  value={pillBreak}
                  onChange={(e) => setPillBreak(e.target.value)}
                />
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Zwykła pora przyjmowania</label>
              <input
                type="time"
                value={pillTime}
                onChange={(e) => setPillTime(e.target.value)}
              />
            </div>
            <p className="muted" style={{ fontSize: 11 }}>
              Cyklia ostrzeże Cię, jeśli tabletkę przyjmiesz znacznie później
              niż o tej porze.
            </p>
            <p className="muted" style={{ fontSize: 11 }}>
              Schematy: 21+7, 24+4, 26+2 albo 28+0 (bez przerwy). Sprawdź
              zawsze ulotkę — lista ma charakter informacyjny.
            </p>
          </div>
        )}

        {patchMode && (
          <div className="j-section">
            <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
              W trybie plastrów kalendarz nie pokazuje owulacji ani dni
              płodnych. Cyklia przypomni o zmianie plastra: nowy naklejasz
              w 1., 8. i 15. dniu cyklu, a w 22. dniu robisz 7-dniową przerwę.
            </p>
            <div className="field">
              <label>Twój plaster (opcjonalnie)</label>
              <select
                value={patchName}
                onChange={(e) => choosePatch(e.target.value)}
              >
                <option value="">Wybierz z listy…</option>
                {(patchesData?.patches || []).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.active}+{p.break})
                  </option>
                ))}
              </select>
            </div>
            {patchName &&
              (() => {
                const found = (patchesData?.patches || []).find(
                  (p) => p.name === patchName
                );
                return found ? (
                  <div className="pill-info">
                    <b>{found.name}</b>
                    <p className="muted" style={{ fontSize: 12.5 }}>
                      {found.hormones}
                    </p>
                    <p className="muted" style={{ fontSize: 12.5 }}>
                      {found.description}
                    </p>
                  </div>
                ) : null;
              })()}
            <p className="muted" style={{ fontSize: 11 }}>
              Plaster naklejasz na skórę (pośladek, brzuch lub ramię) raz
              w tygodniu przez 3 tygodnie, potem 7 dni przerwy. Zawsze
              sprawdzaj ulotkę swojego preparatu.
            </p>
            <details className="pill-details">
              <summary>Wiedza o plastrach</summary>
              {(patchesData?.knowledge || []).map((k) => (
                <div className="pill-kb" key={k.title}>
                  <b>{k.title}</b>
                  <p className="muted" style={{ fontSize: 12.5 }}>
                    {k.body}
                  </p>
                </div>
              ))}
            </details>
          </div>
        )}

        <button className="btn block" onClick={() => save()}>
          {saved ? "✓ Zapisano" : "Zapisz ustawienia"}
        </button>
      </div>
    );
  }

  if (view === "privacy") {
    return (
      <div>
        <div className="sub-screen-head">
          <button className="icon-btn" onClick={() => setView("home")} aria-label="Wróć">
            <Icon name="chevron-left" size={20} />
          </button>
          <h1>Dane i prywatność</h1>
        </div>

        <div className="j-section">
          <div className="set-switch" style={{ padding: "0 0 12px" }}>
            <span className="sw-label">Konto</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {user?.email}
            </span>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Twoje dane (cykle, dziennik, rozmowy z asystentem) są przechowywane
            wyłącznie na Twoim koncie i nie są udostępniane stronom trzecim.
          </p>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico" style={{ background: "var(--blue-100)", color: "var(--blue)" }}>
              <Icon name="info" size={17} />
            </span>
            <b>Wskazówka</b>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Cyklia sama uczy się długości Twojego cyklu z zapisanych okresów.
            Po włączeniu tabletek wystarczy zaznaczyć początek okresu, a
            kolejne daty będą wynikać z przerw między blistrami.
          </p>
        </div>

        <div className="j-section center">
          <Icon name="flower" size={28} style={{ color: "var(--pink-400)" }} />
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            Cyklia — aplikacja edukacyjna. Nie zastępuje porady lekarskiej.
          </p>
        </div>
      </div>
    );
  }

  if (view === "account") {
    return (
      <div>
        <div className="sub-screen-head">
          <button className="icon-btn" onClick={() => setView("home")} aria-label="Wróć">
            <Icon name="chevron-left" size={20} />
          </button>
          <h1>Konto</h1>
        </div>

        <div className="j-section">
          <div className="field">
            <label>E-mail</label>
            <input value={user?.email || ""} disabled />
          </div>
          <div className="field" style={{ marginBottom: 8 }}>
            <label>Imię / pseudonim</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Julia"
            />
          </div>
        </div>

        <button className="btn block mb" onClick={() => save()}>
          {saved ? "✓ Zapisano" : "Zapisz dane"}
        </button>

        <button className="sheet-btn danger" onClick={logoutNow}>
          <Icon name="log-out" size={17} /> Wyloguj się
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="profile-head">
        <div className="avatar-lg">{initial}</div>
        <div style={{ minWidth: 0 }}>
          <div className="profile-name">
            {user?.display_name || "Moje konto"}
          </div>
          <div className="profile-mail">{user?.email}</div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-title">Cykl</div>
        <button className="set-row" onClick={() => setView("cycle")}>
          <span className="set-ico">
            <Icon name="repeat" size={19} />
          </span>
          <span className="sm-title">Cykl i okres</span>
        </button>
        <button className="set-row" onClick={() => setView("pill")}>
          <span className="set-ico">
            <Icon name="pill" size={19} />
          </span>
          <span className="sm-title">Antykoncepcja</span>
        </button>
      </div>

      <div className="settings-group">
        <div className="settings-title">Konto</div>
        <button className="set-row" onClick={() => setView("account")}>
          <span className="set-ico neutral">
            <Icon name="user" size={19} />
          </span>
          <span className="sm-title">Konto</span>
        </button>
        <button className="set-row" onClick={() => setView("privacy")}>
          <span className="set-ico neutral">
            <Icon name="lock" size={19} />
          </span>
          <span className="sm-title">Dane i prywatność</span>
        </button>
      </div>

      <p className="muted center" style={{ fontSize: 11.5, marginTop: 18 }}>
        Cyklia v1 · aplikacja edukacyjna
      </p>
    </div>
  );
}
