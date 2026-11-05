import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { dayMonthPL } from "../utils.js";

// Publiczny widok dla partnera — tylko do odczytu, bez logowania.
export default function PartnerPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/p/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Nie udało się wczytać danych.");
        return j;
      })
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token]);

  if (error) {
    return (
      <>
        <div className="app-bg" />
        <main className="page partner-page">
          <div className="j-section center">
            <Icon name="lock" size={28} style={{ color: "var(--pink-500)" }} />
            <p style={{ marginBottom: 0 }}>{error}</p>
            <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Poproś o nowy link w aplikacji Cyklia.
            </p>
          </div>
        </main>
      </>
    );
  }
  if (!data) return <div className="center-screen">Ładowanie…</div>;

  const today = data.date;
  const fertile = data.fertile;
  const fertileUpcoming = fertile && !fertile.today && fertile.end >= today;
  const pills = data.pills;

  return (
    <>
      <div className="app-bg" />
      <main className="page partner-page">
        <div className="partner-head">
          <span className="partner-badge">
            <Icon name="heart" size={15} /> Cyklia · widok partnera
          </span>
          <h1>Jak się ma {data.name}</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            dziś, {dayMonthPL(today)}
          </div>
        </div>

        <div className="j-section center partner-status">
          <div className="ds-phase">{data.headline}</div>
          {data.sub && <div className="ds-day">{data.sub}</div>}
          {data.phase && data.phase !== data.headline && (
            <div className="ds-note">{data.phase}</div>
          )}
          {data.next_period_start && !data.period_day && (
            <div className="ds-note">
              Następny okres: {dayMonthPL(data.next_period_start)}
            </div>
          )}
        </div>

        {data.feel && (
          <div className="j-section">
            <div className="j-sec-head">
              <span className="js-ico">
                <Icon name="sparkles" size={17} />
              </span>
              <b>Jak może się dziś czuć</b>
            </div>
            <p style={{ marginTop: 0, lineHeight: 1.55 }}>{data.feel.text}</p>
            {(data.feel.symptoms.length > 0 || data.feel.moods.length > 0) && (
              <div className="chips">
                {[...data.feel.moods, ...data.feel.symptoms].map((x) => (
                  <span key={x} className="chip">
                    {x}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {fertile && (fertile.today || fertileUpcoming) && (
          <div className="j-section">
            <div className="j-sec-head">
              <span className="js-ico" style={{ background: "var(--blue-100)", color: "var(--blue)" }}>
                <Icon name="droplet" size={17} />
              </span>
              <b>Dni płodne</b>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {fertile.ovulation_today
                ? "Dziś przewidywana owulacja — najwyższa szansa na ciążę."
                : fertile.today
                ? `Trwają dni płodne (do ${dayMonthPL(fertile.end)}).`
                : `Dni płodne: ${dayMonthPL(fertile.start)} – ${dayMonthPL(fertile.end)}.`}{" "}
              To prognoza, nie metoda antykoncepcji.
            </p>
          </div>
        )}

        {pills && (
          <div className="j-section">
            <div className="j-sec-head">
              <span className="js-ico">
                <Icon name="pill" size={17} />
              </span>
              <b>Tabletki</b>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {pills.in_break
                ? `Przerwa w tabletkach${
                    pills.next_pack_start ? ` · nowy blister ${dayMonthPL(pills.next_pack_start)}` : ""
                  }.`
                : pills.taken
                ? "Dzisiejsza tabletka już wzięta ✓"
                : pills.needs_log
                ? `Dzisiejsza tabletka jeszcze nie zaznaczona (zwykle o ${pills.expected_time}).`
                : "Brak informacji o dzisiejszej tabletce."}
            </p>
          </div>
        )}

        <p className="muted center" style={{ fontSize: 11.5 }}>
          {data.name} udostępnia Ci ten widok w aplikacji Cyklia i może go w każdej
          chwili wyłączyć. Prognozy mają charakter edukacyjny.
        </p>
      </main>
    </>
  );
}
