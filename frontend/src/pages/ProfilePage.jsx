import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";
import { api, download } from "../api/client.js";
import Icon from "../components/Icon.jsx";
import StatsPage from "./StatsPage.jsx";
import NotificationsSettings from "../components/NotificationsSettings.jsx";

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
  const [pillBreak, setPillBreak] = useState(user?.pill_break_days ?? 7);
  const [pillTime, setPillTime] = useState(user?.pill_time || "12:00");
  const [pillStart, setPillStart] = useState(user?.pill_start_date || "");
  const [saved, setSaved] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pwCur, setPwCur] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [delPw, setDelPw] = useState("");
  const [delMsg, setDelMsg] = useState("");
  const [share, setShare] = useState(undefined);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    if (view !== "partner" || share !== undefined) return;
    api("/partner")
      .then((s) => setShare(s))
      .catch((e) => {
        setShare(null);
        setShareMsg(e.message);
      });
  }, [view, share]);

  const shareUrl = share ? `${window.location.origin}/partner/${share.token}` : "";

  async function shareCall(method, body) {
    setShareBusy(true);
    setShareMsg("");
    try {
      const s = await api("/partner", { method, body });
      setShare(s);
      return s;
    } catch (e) {
      setShareMsg(e.message);
      return null;
    } finally {
      setShareBusy(false);
    }
  }

  async function sendLink() {
    const url = shareUrl;
    if (!url) return;
    const text = `Tutaj zobaczysz, w którym momencie cyklu jestem i jak mogę się dziś czuć 💗`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Cyklia", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg("✓ Skopiowano link");
    } catch (e) {
      if (e?.name !== "AbortError") setShareMsg("Skopiuj link ręcznie z pola powyżej.");
    }
  }

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
    setSaveError("");
    const c = Number(cycle);
    const p = Number(period);
    if (!(c >= 14 && c <= 60)) {
      setSaveError("Długość cyklu musi mieć od 14 do 60 dni.");
      return;
    }
    if (!(p >= 1 && p <= 14)) {
      setSaveError("Długość okresu musi mieć od 1 do 14 dni.");
      return;
    }
    let me;
    try {
      me = await api("/me", {
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
        pill_start_date: pillMode ? pillStart : "",
        patch_mode: patchMode,
        patch_name: patchMode ? patchName : "",
        ...extra,
      },
    });
    } catch (err) {
      setSaveError(err.message || "Nie udało się zapisać");
      return;
    }
    updateUser(me || {
      display_name: name,
      cycle_length_default: Number(cycle),
      period_length_default: Number(period),
      pill_mode: pillMode,
      pill_name: pillMode ? pillName : "",
      pill_cycle_days: pillMode ? Number(pillCycle) : 21,
      pill_break_days: pillMode ? Number(pillBreak) : 7,
      pill_time: pillMode ? pillTime : "12:00",
      pill_start_date: pillMode ? pillStart : "",
      patch_mode: patchMode,
      patch_name: patchMode ? patchName : "",
      ...extra,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function logoutNow() {
    await logout();
    navigate("/login");
  }

  async function changePassword() {
    setPwMsg("");
    try {
      await api("/me/password", {
        method: "POST",
        body: { current_password: pwCur, new_password: pwNew },
      });
      setPwCur("");
      setPwNew("");
      setPwMsg("✓ Hasło zmienione");
    } catch (err) {
      setPwMsg(err.message);
    }
  }

  async function deleteAccount() {
    setDelMsg("");
    if (!window.confirm("Na pewno usunąć konto i wszystkie dane? Tego nie da się cofnąć.")) return;
    try {
      await api("/me", { method: "DELETE", body: { password: delPw } });
      await logout();
      navigate("/login");
    } catch (err) {
      setDelMsg(err.message);
    }
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

        {saveError && <div className="error">{saveError}</div>}
        <button className="btn block" onClick={() => save()}>
          {saved ? "✓ Zapisano" : "Zapisz ustawienia"}
        </button>

        <button
          className="btn ghost block"
          style={{ marginTop: 10 }}
          disabled={pdfBusy}
          onClick={async () => {
            setPdfBusy(true);
            setPdfError("");
            try {
              await download("/report/pdf", "raport-ginekolog.pdf");
            } catch (e) {
              setPdfError(e.message || "Nie udało się wygenerować raportu");
            } finally {
              setPdfBusy(false);
            }
          }}
        >
          {pdfBusy ? "Generowanie…" : "Wygeneruj PDF dla ginekologa"}
        </button>
        {pdfError && (
          <p className="muted" style={{ color: "var(--red)", marginTop: 8 }}>
            {pdfError}
          </p>
        )}
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
            <div className="field" style={{ marginTop: 12 }}>
              <label>Dzień rozpoczęcia przyjmowania tabletek</label>
              <input
                type="date"
                value={pillStart}
                onChange={(e) => setPillStart(e.target.value)}
              />
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                Podaj pierwszą datę, w której zaczęłaś nowy blister. Cyklia
                policzy z niej: dni przyjmowania ({pillCycle || 21} dni),
                potem {pillBreak ?? 7}-dniową przerwę i kolejny start — nawet
                gdy nie zaznaczasz okresu w kalendarzu.
              </p>
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

        {saveError && <div className="error">{saveError}</div>}
        <button className="btn block" onClick={() => save()}>
          {saved ? "✓ Zapisano" : "Zapisz ustawienia"}
        </button>
      </div>
    );
  }

  if (view === "stats") {
    return (
      <div>
        <div className="sub-screen-head">
          <button className="icon-btn" onClick={() => setView("home")} aria-label="Wróć">
            <Icon name="chevron-left" size={20} />
          </button>
          <h1>Statystyki</h1>
        </div>
        <StatsPage />
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

  if (view === "partner") {
    const OPTS = [
      { key: "show_feel", label: "Jak mogę się dziś czuć", hint: "Podpowiedź z Twojej historii objawów i nastrojów + jak Cię wspierać" },
      { key: "show_fertile", label: "Dni płodne", hint: "Okno płodne i owulacja (gdy nie stosujesz antykoncepcji)" },
      { key: "show_pills", label: "Tabletki", hint: "Czy dzisiejsza tabletka jest już wzięta, przerwa w blistrze" },
    ];
    return (
      <div>
        <div className="sub-screen-head">
          <button className="icon-btn" onClick={() => setView("home")} aria-label="Wróć">
            <Icon name="chevron-left" size={20} />
          </button>
          <h1>Partner</h1>
        </div>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico">
              <Icon name="users" size={17} />
            </span>
            <b>Udostępnij partnerowi</b>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Partner dostaje prywatny link (bez zakładania konta) i widzi tylko
            dzisiejszy stan: dzień okresu lub cyklu, ile dni do okresu oraz to,
            co włączysz poniżej. Nie widzi Twojego dziennika ani notatek.
          </p>

          {share === undefined ? (
            <p className="muted">Ładowanie…</p>
          ) : share ? (
            <>
              <div className="partner-link">{shareUrl}</div>
              <button className="btn block" onClick={sendLink}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon name="send" size={16} /> Wyślij link partnerowi
                </span>
              </button>
              <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                {share.last_viewed_at
                  ? `Ostatnio otwarty: ${new Date(share.last_viewed_at).toLocaleString("pl-PL", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Partner jeszcze nie otworzył linku."}
              </p>
            </>
          ) : (
            <button className="btn block" disabled={shareBusy} onClick={() => shareCall("POST", {})}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon name="link" size={16} /> Utwórz link dla partnera
              </span>
            </button>
          )}
          {shareMsg && (
            <div className={shareMsg.startsWith("✓") ? "muted" : "error"} style={{ marginTop: 10 }}>
              {shareMsg}
            </div>
          )}
        </div>

        {share && (
          <>
            <div className="settings-group" style={{ padding: 0 }}>
              <div className="settings-title" style={{ padding: "12px 18px 0" }}>
                Co widzi partner
              </div>
              {OPTS.map((o) => (
                <div className="set-switch" key={o.key}>
                  <span style={{ minWidth: 0 }}>
                    <span className="sw-label">{o.label}</span>
                    <span className="muted" style={{ display: "block", fontSize: 12 }}>
                      {o.hint}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="switch"
                    checked={!!share[o.key]}
                    disabled={shareBusy}
                    onChange={(e) => shareCall("PATCH", { [o.key]: e.target.checked })}
                    aria-label={o.label}
                  />
                </div>
              ))}
            </div>

            <button
              className="btn ghost block"
              disabled={shareBusy}
              onClick={() => {
                if (window.confirm("Utworzyć nowy link? Stary przestanie działać.")) shareCall("POST", {});
              }}
            >
              Utwórz nowy link (stary przestanie działać)
            </button>
            <button
              className="sheet-btn danger"
              style={{ marginTop: 10 }}
              disabled={shareBusy}
              onClick={async () => {
                if (!window.confirm("Wyłączyć udostępnianie? Partner straci dostęp.")) return;
                await shareCall("DELETE");
              }}
            >
              <Icon name="x" size={17} /> Wyłącz udostępnianie
            </button>
          </>
        )}
      </div>
    );
  }

  if (view === "notifications") {
    return (
      <div>
        <div className="sub-screen-head">
          <button className="icon-btn" onClick={() => setView("home")} aria-label="Wróć">
            <Icon name="chevron-left" size={20} />
          </button>
          <h1>Powiadomienia</h1>
        </div>
        <NotificationsSettings />
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

        {saveError && <div className="error">{saveError}</div>}
        <button className="btn block mb" onClick={() => save()}>
          {saved ? "✓ Zapisano" : "Zapisz dane"}
        </button>

        <div className="j-section">
          <div className="j-sec-head">
            <span className="js-ico"><Icon name="lock" size={17} /></span>
            <b>Zmień hasło</b>
          </div>
          <div className="field">
            <label>Obecne hasło</label>
            <input type="password" autoComplete="current-password" value={pwCur} onChange={(e) => setPwCur(e.target.value)} />
          </div>
          <div className="field">
            <label>Nowe hasło (min. 6 znaków)</label>
            <input type="password" autoComplete="new-password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
          </div>
          {pwMsg && (
            <div className={pwMsg.startsWith("✓") ? "muted" : "error"} style={{ marginBottom: 10 }}>{pwMsg}</div>
          )}
          <button className="btn ghost block" disabled={!pwCur || pwNew.length < 6} onClick={changePassword}>
            Zmień hasło
          </button>
        </div>

        <button className="sheet-btn danger" onClick={logoutNow}>
          <Icon name="log-out" size={17} /> Wyloguj się
        </button>

        <div className="j-section" style={{ marginTop: 18 }}>
          <div className="j-sec-head">
            <span className="js-ico" style={{ background: "var(--red-100)", color: "var(--red)" }}>
              <Icon name="trash" size={17} />
            </span>
            <b>Usuń konto</b>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Usuwa konto i wszystkie dane: cykle, dziennik, tabletki, rozmowy.
          </p>
          <div className="field">
            <label>Hasło (potwierdzenie)</label>
            <input type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
          </div>
          {delMsg && <div className="error">{delMsg}</div>}
          <button className="sheet-btn danger" disabled={!delPw} onClick={deleteAccount}>
            <Icon name="trash" size={17} /> Usuń konto na zawsze
          </button>
        </div>
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
        <button className="set-row" onClick={() => setView("notifications")}>
          <span className="set-ico">
            <Icon name="bell" size={19} />
          </span>
          <span className="sm-title">Powiadomienia</span>
        </button>
        <button className="set-row" onClick={() => setView("partner")}>
          <span className="set-ico">
            <Icon name="users" size={19} />
          </span>
          <span className="sm-title">Partner</span>
        </button>
        <button className="set-row" onClick={() => setView("stats")}>
          <span className="set-ico">
            <Icon name="chart" size={19} />
          </span>
          <span className="sm-title">Statystyki</span>
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
