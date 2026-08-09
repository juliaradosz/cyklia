import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import {
  emojiFor,
  toneFor,
  categoryMeta,
} from "../inspiration.js";

export default function InspirationArticlePage() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [all, setAll] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api(`/articles/${id}`)
      .then((a) => {
        setArticle(a);
        setSaved(!!a.saved);
      })
      .catch(() => {});
    api("/articles")
      .then(setAll)
      .catch(() => {});
  }, [id]);

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    try {
      const res = await api(`/articles/${article.id}/save`, { method: "POST" });
      setSaved(res.saved);
    } catch {
      setSaved(!next);
    }
  }

  if (!article) return <div className="center-screen">Ładowanie…</div>;

  const tone = toneFor(article);
  const content = article.content || {};
  const related = (article.related || [])
    .map((slug) => all.find((a) => a.slug === slug))
    .filter(Boolean);

  return (
    <div className="insp-article">
      <Link to="/inspiracje" className="back-link">
        ← Inspiracje
      </Link>

      <div className="insp-art-hero" style={{ background: tone.g }}>
        <span className="insp-art-emoji">{emojiFor(article)}</span>
        <div className="insp-art-top">
          {article.category && (
            <span className="insp-art-cat">
              {categoryMeta(article.category).emoji} {article.category}
            </span>
          )}
          <button
            className={`save-btn ${saved ? "saved" : ""}`}
            onClick={toggleSave}
          >
            {saved ? "♥ Zapisane" : "♡ Zapisz"}
          </button>
        </div>
        <h1 className="insp-art-title">{article.title}</h1>
        <div className="insp-art-meta">
          {article.read_minutes} min czytania
          {article.badge ? ` · ${article.badge}` : ""}
        </div>
      </div>

      {article.intro && <p className="insp-art-intro">{article.intro}</p>}

      <div className="insp-art-body">
        {(content.sections || []).map((sec, i) => (
          <div key={i} className="insp-sec">
            <h2 className="insp-sec-h">{sec.h}</h2>
            {sec.p && sec.p.map((para, j) => <p key={j}>{para}</p>)}
            {sec.ul && (
              <ul className="insp-list">
                {sec.ul.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {content.info && (
          <div className="insp-box info">
            <div className="insp-box-title">💡 {content.info.title || "Warto wiedzieć"}</div>
            {content.info.p && <p>{content.info.p}</p>}
            {content.info.items && (
              <ul>
                {content.info.items.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {content.remember && (
          <div className="insp-box remember">
            <div className="insp-box-title">🧡 Zapamiętaj</div>
            <ul>
              {content.remember.map((x, j) => (
                <li key={j}>{x}</li>
              ))}
            </ul>
          </div>
        )}

        {content.doctor && (
          <div className="insp-box doctor">
            <div className="insp-box-title">🩺 Kiedy skontaktować się z lekarzem?</div>
            <ul>
              {content.doctor.map((x, j) => (
                <li key={j}>{x}</li>
              ))}
            </ul>
          </div>
        )}

        {content.summary && <p className="insp-art-summary">{content.summary}</p>}
      </div>

      {related.length > 0 && (
        <div className="insp-section">
          <div className="cat-head">
            <span className="cat-emoji">📖</span>
            <div>
              <h2>Przeczytaj też</h2>
              <div className="cat-tagline">Powiązane artykuły</div>
            </div>
          </div>
          <div className="insp-row">
            {related.map((a) => (
              <Link
                key={a.id}
                to={`/inspiracje/${a.id}`}
                className="insp-card"
                style={{ background: toneFor(a).g }}
              >
                <div className="insp-ill">
                  <span className="insp-emoji">{emojiFor(a)}</span>
                </div>
                {a.badge && <span className="insp-badge">{a.badge}</span>}
                <h3 className="insp-title">{a.title}</h3>
                <div className="insp-meta">
                  {a.read_minutes} min · {a.category}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Porozmawiaj z asystentem</h3>
        <p className="muted">
          Masz pytania o ten temat? Zapytaj darmowego asystenta AI.
        </p>
        <Link to="/czat" className="btn small">
          💬 Zadaj pytanie
        </Link>
      </div>
    </div>
  );
}
