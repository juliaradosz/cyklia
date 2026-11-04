import { useEffect, useState } from "react";
import { useAuth } from "../api/auth.jsx";
import { api } from "../api/client.js";
import Icon from "./Icon.jsx";
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIOS,
  isStandalone,
  pushSupported,
} from "../push.js";

const KINDS = [
  { key: "notify_pill", label: "Tabletka", hint: "O Twojej porze i ponownie po 2 godz., jeśli nie zaznaczysz", only: "pill" },
  { key: "notify_patch", label: "Plaster", hint: "W dniu zmiany / zdjęcia plastra", only: "patch" },
  { key: "notify_period", label: "Okres", hint: "Kilka dni przed prognozą i w dniu okresu" },
  { key: "notify_fertile", label: "Dni płodne", hint: "Pierwszy dzień okna płodnego (bez antykoncepcji)", only: "none" },
];

export default function NotificationsSettings() {
  const { user, updateUser } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const method = user?.patch_mode ? "patch" : user?.pill_mode ? "pill" : "none";
  const supported = pushSupported();
  const permission = supported ? Notification.permission : "unsupported";

  useEffect(() => {
    currentSubscription()
      .then((s) => setEnabled(!!s && Notification.permission === "granted"))
      .catch(() => setEnabled(false));
  }, []);

  async function toggleDevice() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        setMsg("Powiadomienia wyłączone na tym urządzeniu.");
      } else {
        await enablePush();
        setEnabled(true);
        setMsg("Powiadomienia włączone na tym urządzeniu ✓");
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await api("/push/test", { method: "POST" });
      setMsg("Wysłano testowe powiadomienie — powinno pojawić się za chwilę.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setPref(key, value) {
    setErr("");
    try {
      const me = await api("/me", { method: "PATCH", body: { [key]: value } });
      updateUser(me);
    } catch (e) {
      setErr(e.message);
    }
  }

  const visible = KINDS.filter((k) => !k.only || k.only === method);
  const lead = user?.notify_period_days ?? 2;

  return (
    <>
      <div className="j-section">
        <div className="set-switch" style={{ padding: "0 0 8px" }}>
          <span className="sw-label">Powiadomienia na tym urządzeniu</span>
          <input
            type="checkbox"
            className="switch"
            checked={enabled}
            disabled={busy || !supported}
            onChange={toggleDevice}
            aria-label="Powiadomienia na tym urządzeniu"
          />
        </div>
        {!supported && isIOS() && !isStandalone() && (
          <p className="muted" style={{ fontSize: 13 }}>
            Na iPhonie powiadomienia działają tylko z ikony na ekranie głównym
            (iOS 16.4 lub nowszy): w Safari dotknij <b>Udostępnij</b> →{" "}
            <b>Dodaj do ekranu głównego</b>, otwórz Cyklię z ikony i wróć tutaj.
          </p>
        )}
        {!supported && !(isIOS() && !isStandalone()) && (
          <p className="muted" style={{ fontSize: 13 }}>
            Ta przeglądarka nie obsługuje powiadomień push.
          </p>
        )}
        {supported && permission === "denied" && (
          <p className="muted" style={{ fontSize: 13 }}>
            Powiadomienia są zablokowane w ustawieniach przeglądarki/telefonu —
            odblokuj je dla tej strony i spróbuj ponownie.
          </p>
        )}
        {err && <div className="error">{err}</div>}
        {msg && <p className="muted" style={{ fontSize: 13 }}>{msg}</p>}
        {enabled && (
          <button className="btn ghost block" disabled={busy} onClick={test}>
            <Icon name="bell" size={16} /> Wyślij testowe powiadomienie
          </button>
        )}
      </div>

      <div className="settings-group" style={{ padding: 0 }}>
        <div className="settings-title" style={{ padding: "12px 18px 0" }}>
          O czym przypominać
        </div>
        {visible.map((k) => (
          <div className="set-switch" key={k.key}>
            <span style={{ minWidth: 0 }}>
              <span className="sw-label">{k.label}</span>
              <span className="muted" style={{ display: "block", fontSize: 12 }}>
                {k.hint}
              </span>
            </span>
            <input
              type="checkbox"
              className="switch"
              checked={!!user?.[k.key]}
              onChange={(e) => setPref(k.key, e.target.checked)}
              aria-label={k.label}
            />
          </div>
        ))}
        {!!user?.notify_period && (
          <div className="set-switch">
            <span className="sw-label">Ile dni przed okresem</span>
            <select
              value={lead}
              onChange={(e) => setPref("notify_period_days", Number(e.target.value))}
              style={{ width: 90 }}
            >
              {[0, 1, 2, 3, 5, 7].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "tylko w dniu" : `${n} ${n === 1 ? "dzień" : "dni"}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12 }}>
        Przypomnienie o tabletce przychodzi o porze ustawionej w
        „Antykoncepcja” ({user?.pill_time || "12:00"}). Pozostałe przypomnienia
        wysyłamy między 9:00 a 22:00.
      </p>
    </>
  );
}
