import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";
import { api } from "../api/client.js";

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.display_name || "");
  const [cycle, setCycle] = useState(user?.cycle_length_default || 28);
  const [period, setPeriod] = useState(user?.period_length_default || 5);
  const [pillMode, setPillMode] = useState(!!user?.pill_mode);
  const [pills, setPills] = useState([]);
  const [pillName, setPillName] = useState(user?.pill_name || "");
  const [pillCycle, setPillCycle] = useState(user?.pill_cycle_days || 21);
  const [pillBreak, setPillBreak] = useState(user?.pill_break_days || 7);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api("/pills")
      .then(setPills)
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

  async function save() {
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
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function logoutNow() {
    logout();
    navigate("/login");
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Profil</h1>
          <div className="sub">Twoje konto i ustawienia</div>
        </div>
      </div>

      <div className="card">
        <h2>Dane konta</h2>
        <div className="field">
          <label>E-mail</label>
          <input value={user?.email || ""} disabled />
        </div>
        <div className="field">
          <label>Imię / pseudonim</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <h2>Naturalny cykl</h2>
        <p className="muted">
          Te ustawienia są używane, gdy nie przyjmujesz antykoncepcji
          hormonalnej.
        </p>
        <div className="spread">
          <div className="field" style={{ flex: 1 }}>
            <label>Długość cyklu (dni)</label>
            <input
              type="number"
              min="14"
              max="60"
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
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

      <div className="card">
        <h2>💊 Antykoncepcja hormonalna</h2>
        <div className="row mb">
          <span>Stosuję tabletki antykoncepcyjne</span>
          <input
            type="checkbox"
            checked={pillMode}
            onChange={(e) => setPillMode(e.target.checked)}
            style={{ width: 22, height: 22 }}
          />
        </div>
        {pillMode && (
          <>
            <p className="muted" style={{ fontSize: 12 }}>
              W trybie tabletek kalendarz nie pokazuje owulacji ani dni
              płodnych (hormonoterapia je blokuje), a kolejny okres przewiduje
              w przerwie między blistrami.
            </p>
            <div className="field">
              <label>Twój środek (opcjonalnie — wypełni schemat)</label>
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
            <div className="spread">
              <div className="field" style={{ flex: 1 }}>
                <label>Dni przyjmowania</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={pillCycle}
                  onChange={(e) => setPillCycle(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
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
            <p className="muted" style={{ fontSize: 11 }}>
              Schematy: 21+7, 24+4, 26+2 albo 28+0 (bez przerwy, np. tabletki
              progestagenowe). Sprawdź zawsze ulotkę — lista ma charakter
              informacyjny.
            </p>
          </>
        )}
      </div>

      <button className="btn block mb" onClick={save}>
        {saved ? "✓ Zapisano" : "Zapisz ustawienia"}
      </button>

      <div className="card">
        <h2>Wskazówka</h2>
        <p className="muted">
          Cyklia sama uczy się długości Twojego cyklu z zapisanych okresów.
          Po włączeniu tabletek wystarczy zaznaczyć początek okresu, a
          kolejne daty będą wynikać z przerw między blistrami.
        </p>
      </div>

      <div className="card center">
        <p className="muted" style={{ fontSize: 12 }}>
          Cyklia 🌸 — aplikacja edukacyjna. Nie zastępuje porady lekarskiej.
        </p>
        <button className="btn danger" onClick={logoutNow}>
          Wyloguj się
        </button>
      </div>
    </div>
  );
}
