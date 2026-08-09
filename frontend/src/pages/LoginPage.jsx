import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-logo">
        <div className="flower">🌸</div>
        <h1>Cyklia</h1>
        <p>Twój cykl, owulacja i samopoczucie w jednym miejscu</p>
      </div>
      <form onSubmit={submit} className="card">
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="twoj@email.pl"
            required
          />
        </div>
        <div className="field">
          <label>Hasło</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <button className="btn block" disabled={busy}>
          {busy ? "Logowanie…" : "Zaloguj się"}
        </button>
        <p className="center muted mt">
          Nie masz konta? <Link to="/register">Zarejestruj się</Link>
        </p>
      </form>
    </div>
  );
}
