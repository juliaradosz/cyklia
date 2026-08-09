import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { shortPL, MOODS } from "../utils.js";

function Bars({ label, rows, fmt }) {
  const vals = rows.filter((r) => r.v != null);
  if (!vals.length) return null;
  const max = Math.max(...vals.map((r) => r.v)) || 1;
  return (
    <div className="mb">
      <div className="row">
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      {vals.map((r) => (
        <div key={r.label} className="mb">
          <div className="row">
            <span style={{ fontSize: 13 }}>{r.label}</span>
            <span className="muted">{fmt ? fmt(r.v) : r.v}</span>
          </div>
          <div className="bar">
            <div style={{ width: `${(r.v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Spark({ points, tip }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points.map((p) => p[1]));
  const max = Math.max(...points.map((p) => p[1]));
  const range = Math.max(max - min, 0.1);
  return (
    <div className="spark-row">
      {points.map(([d, v]) => (
        <div
          key={d}
          className="spark-col"
          title={`${shortPL(d)}: ${tip(v)}`}
          style={{ height: `${((v - min) / range) * 100}%` }}
        >
          <span className="val">{v}</span>
          <span className="tip">{shortPL(d)}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api("/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return <div className="center-screen">Ładowanie…</div>;

  const moodKeys = Object.keys(stats.moods || {});
  const moodTotal = moodKeys.reduce((s, k) => s + stats.moods[k], 0) || 1;
  const symKeys = Object.entries(stats.symptoms || {}).sort((a, b) => b[1] - a[1]);
  const symMax = symKeys.length ? symKeys[0][1] : 1;

  const temps = stats.temps || [];
  const tempMin = temps.length ? Math.min(...temps.map((t) => t[1])) : 0;
  const tempMax = temps.length ? Math.max(...temps.map((t) => t[1])) : 1;
  const tempRange = Math.max(tempMax - tempMin, 0.1);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Statystyki</h1>
          <div className="sub">Podsumowanie Twojego cyklu i nawyków</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="num">
            {stats.average_cycle !== null ? stats.average_cycle : "—"}
          </div>
          <div className="lbl">śr. długość cyklu (dni)</div>
        </div>
        <div className="stat-box">
          <div className="num">
            {stats.average_period !== null ? stats.average_period : "—"}
          </div>
          <div className="lbl">śr. długość okresu (dni)</div>
        </div>
        <div className="stat-box">
          <div className="num">{stats.cycle_count}</div>
          <div className="lbl">zapisane okresy</div>
        </div>
        <div className="stat-box">
          <div className="num">{stats.entry_count}</div>
          <div className="lbl">wpisy w dzienniku</div>
        </div>
      </div>

      {(stats.average_sleep || stats.total_steps || stats.average_activity) && (
        <div className="stat-grid">
          <div className="stat-box">
            <div className="num">
              {stats.average_sleep !== null ? stats.average_sleep : "—"}
            </div>
            <div className="lbl">śr. sen (h)</div>
          </div>
          <div className="stat-box">
            <div className="num">
              {stats.total_steps ? stats.total_steps.toLocaleString("pl-PL") : "—"}
            </div>
            <div className="lbl">kroki łącznie</div>
          </div>
          <div className="stat-box">
            <div className="num">
              {stats.average_activity !== null ? stats.average_activity : "—"}
            </div>
            <div className="lbl">śr. aktywność (min)</div>
          </div>
        </div>
      )}

      <div className="card mt">
        <h2>Temperatura bazowa</h2>
        {temps.length < 2 ? (
          <p className="muted">
            Dodaj co najmniej 2 pomiary w dzienniku, by zobaczyć wykres.
          </p>
        ) : (
          <>
            <div className="spark-row">
              {temps.slice(-14).map(([d, t]) => (
                <div
                  key={d}
                  className="spark-col"
                  title={`${shortPL(d)}: ${t}°C`}
                  style={{
                    height: `${((t - tempMin) / tempRange) * 100}%`,
                  }}
                >
                  <span className="val">{t.toFixed(1)}</span>
                  <span className="tip">{shortPL(d)}</span>
                </div>
              ))}
            </div>
            <p className="muted center" style={{ fontSize: 12 }}>
              Ostatnie 14 pomiarów — po owulacji temperatura rośnie o ok.
              0,2–0,5°C
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h2>Nastroje</h2>
        {moodKeys.length === 0 ? (
          <p className="muted">Zapisuj nastrój w dzienniku, by zobaczyć podsumowanie.</p>
        ) : (
          moodKeys.map((k) => {
            const m = MOODS.find((x) => x.key === k) || { emoji: "😐", label: k };
            return (
              <div key={k} className="mb">
                <div className="row">
                  <span style={{ fontSize: 13 }}>
                    {m.emoji} {m.label}
                  </span>
                  <span className="muted">{stats.moods[k]}×</span>
                </div>
                <div className="bar">
                  <div style={{ width: `${(stats.moods[k] / moodTotal) * 100}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <h2>Najczęstsze objawy</h2>
        {symKeys.length === 0 ? (
          <p className="muted">Zaznaczaj objawy w dzienniku, by zobaczyć statystyki.</p>
        ) : (
          symKeys.slice(0, 8).map(([s, n]) => (
            <div key={s} className="mb">
              <div className="row">
                <span style={{ fontSize: 13 }}>{s}</span>
                <span className="muted">{n}×</span>
              </div>
              <div className="bar">
                <div style={{ width: `${(n / symMax) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>Sen i ruch a faza cyklu</h2>
        {stats.phases && stats.phases.length ? (
          <>
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              Średnie w każdej fazie — zobaczysz, kiedy śpisz i ruszasz się
              najwięcej.
            </p>
            <Bars
              label="Średni sen (h)"
              rows={stats.phases.map((p) => ({ label: p.phase, v: p.sleep }))}
            />
            <Bars
              label="Średnie kroki"
              rows={stats.phases.map((p) => ({ label: p.phase, v: p.steps }))}
              fmt={(v) => v.toLocaleString("pl-PL")}
            />
            <Bars
              label="Średnia aktywność (min)"
              rows={stats.phases.map((p) => ({ label: p.phase, v: p.activity }))}
            />
          </>
        ) : (
          <p className="muted">
            Zapisuj sen, kroki i aktywność w dzienniku, by zobaczyć, jak
            zmieniają się w trakcie cyklu.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Sen i kroki — ostatnie 14 dni</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          Sen (h)
        </p>
        {stats.sleep_trend && stats.sleep_trend.length >= 2 ? (
          <Spark points={stats.sleep_trend} tip={(v) => `${v} h`} />
        ) : (
          <p className="muted">Za mało danych o śnie.</p>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Kroki
        </p>
        {stats.steps_trend && stats.steps_trend.length >= 2 ? (
          <Spark
            points={stats.steps_trend}
            tip={(v) => `${v.toLocaleString("pl-PL")} kroków`}
          />
        ) : (
          <p className="muted">Za mało danych o krokach.</p>
        )}
      </div>

      {stats.last_period_start && (
        <p className="muted center" style={{ fontSize: 12 }}>
          Ostatnia miesiączka rozpoczęła się: {shortPL(stats.last_period_start)}
        </p>
      )}
    </div>
  );
}
