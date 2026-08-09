import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";
import { api } from "../api/client.js";

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.display_name || "");
  const [cycle, setCycle] = useState(user?.cycle_length_default || 28);
  const [period, setPeriod] = useState(user?.period_length_default || 5);
  const [saved, setSaved] = useState(false);

  async function save() {
    await api("/me", {
      method: "PATCH",
      body: {
        display_name: name,
        cycle_length_default: Number(cycle),
        period_length_default: Number(period),
      },
    });
    updateUser({
      display_name: name,
      cycle_length_default: Number(cycle),
      period_length_default: Number(period),
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
          <div className="sub">Twoje konto i domyślne ustawienia cyklu</div>
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
        <h2 style={{ marginTop: 18 }}>Domyślny cykl</h2>
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
              min="14"
              max="60"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
        </div>
        <button className="btn block" onClick={save}>
          {saved ? "✓ Zapisano" : "Zapisz ustawienia"}
        </button>
      </div>

      <div className="card">
        <h2>Wskazówka</h2>
        <p className="muted">
          Cyklia sama uczy się długości Twojego cyklu z zapisanych okresów.
          Ustawienia domyślne są używane, dopóki nie zgromadzisz danych.
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
