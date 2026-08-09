import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useCalendar } from "../hooks.js";
import {
  CATEGORY_ORDER,
  categoryMeta,
  emojiFor,
  toneFor,
  currentPhase,
  PHASE_INFO,
  recommendedArticles,
  filterArticles,
} from "../inspiration.js";

function Card({ article }) {
  const tone = toneFor(article);
  const [saved, setSaved] = useState(!!article.saved);

  async function toggleSave(e) {
    e.preventDefault();
    const next = !saved;
    setSaved(next);
    try {
      const res = await api(`/articles/${article.id}/save`, { method: "POST" });
      setSaved(res.saved);
    } catch {
      setSaved(!next);
    }
  }

  return (
    <Link to={`/inspiracje/${article.id}`} className="insp-card" style={{ background: tone.g }}>
      <div className="insp-ill">
        <span className="insp-emoji">{emojiFor(article)}</span>
        <button
          className={`save-btn ${saved ? "saved" : ""}`}
          onClick={toggleSave}
          aria-label={saved ? "Usuń z zapisanych" : "Zapisz artykuł"}
        >
          {saved ? "♥" : "♡"}
        </button>
      </div>
      {article.badge && <span className="insp-badge">{article.badge}</span>}
      <h3 className="insp-title">{article.title}</h3>
      <div className="insp-meta">
        {article.read_minutes} min · {article.category}
      </div>
    </Link>
  );
}

function Carousel({ items, emptyText }) {
  if (!items.length) return <p className="muted">{emptyText}</p>;
  return (
    <div className="insp-row">
      {items.map((a) => (
        <Card key={a.id} article={a} />
      ))}
    </div>
  );
}

export default function InspiracjePage() {
  const { data: cal } = useCalendar();
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState("");
  const [savedList, setSavedList] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api("/articles")
      .then(setArticles)
      .catch(() => {})
      .finally(() => setLoaded(true));
    api("/saved-articles")
      .then(setSavedList)
      .catch(() => setSavedList([]));
  }, []);

  const phase = currentPhase(cal);
  const phaseInfo = PHASE_INFO[phase] || {
    emoji: "🌸",
    name: "Poznaj swój cykl",
    headline: "Wiedza o Twoim cyklu",
    desc: "Artykuły dopasowane do etapu Twojego cyklu, o którym mówi kalendarz.",
  };

  const filtered = useMemo(
    () => filterArticles(articles, query),
    [articles, query]
  );
  const forYou = useMemo(
    () => recommendedArticles(articles, cal),
    [articles, cal]
  );

  if (!loaded) return <div className="center-screen">Ładowanie…</div>;

  return (
    <div className="inspiracje">
      <div className="page-header">
        <div>
          <h1>Inspiracje</h1>
          <div className="sub">Biblioteka wiedzy o cyklu i zdrowiu</div>
        </div>
      </div>

      <div className="for-you">
        <div className="for-you-head">
          <span className="for-you-emoji">{phaseInfo.emoji}</span>
          <div>
            <div className="for-you-label">Dla Ciebie · {phaseInfo.name}</div>
            <div className="for-you-title">{phaseInfo.headline}</div>
            <div className="for-you-desc">{phaseInfo.desc}</div>
          </div>
        </div>
        <Carousel items={forYou} emptyText="Dodaj okres w kalendarzu, by dopasować treści." />
      </div>

      <div className="search-wrap">
        <span className="search-ico">🔍</span>
        <input
          className="search-input"
          placeholder="Czego chcesz się dowiedzieć?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery("")}>
            ✕
          </button>
        )}
      </div>

      {query ? (
        <div>
          <div className="muted" style={{ marginBottom: 12 }}>
            {filtered.length} {filtered.length === 1 ? "wynik" : "wyników"} dla „{query}”
          </div>
          <div className="insp-grid">
            {filtered.map((a) => (
              <Card key={a.id} article={a} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {savedList.length > 0 && (
            <section className="insp-section">
              <div className="cat-head">
                <span className="cat-emoji">♥</span>
                <div>
                  <h2>Zapisane</h2>
                  <div className="cat-tagline">Twoje ulubione artykuły</div>
                </div>
              </div>
              <Carousel items={savedList} />
            </section>
          )}

          {CATEGORY_ORDER.map((cat) => {
            const items = articles.filter((a) => a.category === cat);
            if (!items.length) return null;
            const meta = categoryMeta(cat);
            return (
              <section key={cat} className="insp-section">
                <div className="cat-head">
                  <span className="cat-emoji">{meta.emoji}</span>
                  <div>
                    <h2>{cat}</h2>
                    <div className="cat-tagline">{meta.tagline}</div>
                  </div>
                </div>
                <Carousel items={items} />
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
