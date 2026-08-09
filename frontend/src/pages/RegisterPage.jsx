import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }
    setBusy(true);
    try {
      await register({ display_name: name, email, password });
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
        <p>Dołącz — obserwuj cykl, zdrowie i samopoczucie</p>
      </div>
      <form onSubmit={submit} className="card">
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>Imię / pseudonim</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Ania"
          />
        </div>
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
          <label>Hasło (min. 6 znaków)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <button className="btn block" disabled={busy}>
          {busy ? "Tworzenie konta…" : "Utwórz konto"}
        </button>
        <p className="center muted mt">
          Masz już konto? <Link to="/login">Zaloguj się</Link>
        </p>
      </form>
    </div>
  );
}
