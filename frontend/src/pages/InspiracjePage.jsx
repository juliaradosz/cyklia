import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useCalendar } from "../hooks.js";
import Icon from "../components/Icon.jsx";
import InspCard from "../components/InspCard.jsx";
import {
  CATEGORY_ORDER,
  categoryMeta,
  currentPhase,
  PHASE_INFO,
  recommendedArticles,
  filterArticles,
} from "../inspiration.js";

function Carousel({ items, emptyText }) {
  if (!items.length) return <p className="muted">{emptyText}</p>;
  return (
    <div className="insp-row">
      {items.map((a) => (
        <InspCard key={a.id} article={a} />
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
        <span className="search-ico">
          <Icon name="search" size={18} />
        </span>
        <input
          className="search-input"
          placeholder="Czego chcesz się dowiedzieć?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery("")}>
            <Icon name="x" size={14} />
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
              <InspCard key={a.id} article={a} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {savedList.length > 0 && (
            <section className="insp-section">
              <div className="cat-head">
                <span className="cat-emoji" style={{ background: "var(--surface-2)" }}>
                  <Icon name="heart" size={20} style={{ color: "var(--pink-600)" }} />
                </span>
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
                <Link
                  to={`/inspiracje/kategoria/${encodeURIComponent(cat)}`}
                  className="cat-head cat-link"
                >
                  <span className="cat-emoji">{meta.emoji}</span>
                  <div className="cat-main">
                    <h2>{cat}</h2>
                    <div className="cat-tagline">{meta.tagline}</div>
                  </div>
                  <span className="cat-more">
                    Zobacz wszystkie
                    <Icon name="chevron-right" size={16} />
                  </span>
                </Link>
                <Carousel items={items} />
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
